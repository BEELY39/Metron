import Stripe from 'stripe'
import { DateTime } from 'luxon'
import env from '#start/env'
import User from '#models/user'
import ProcessedEvent from '#models/processed_event'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2025-02-24.acacia',
})

export class StripeService {
  /**
   * Crée ou récupère un customer Stripe pour un utilisateur
   */
  static async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: user.id.toString(),
      },
    })

    user.stripeCustomerId = customer.id
    await user.save()

    return customer.id
  }

  /**
   * Crée une session de checkout pour l'abonnement Pro
   */
  static async createCheckoutSession(user: User): Promise<string> {
    const customerId = await this.getOrCreateCustomer(user)
    const priceId = env.get('STRIPE_PRO_PRICE_ID')
    const frontendUrl = env.get('FRONTEND_URL')

    if (!priceId) {
      throw new Error('STRIPE_PRO_PRICE_ID non configuré')
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/dashboard?payment=success`,
      cancel_url: `${frontendUrl}/dashboard?payment=cancelled`,
      metadata: {
        userId: user.id.toString(),
      },
    })

    return session.url!
  }

  /**
   * Crée un portail client pour gérer l'abonnement
   */
  static async createPortalSession(user: User): Promise<string> {
    if (!user.stripeCustomerId) {
      throw new Error('Aucun compte Stripe associé')
    }

    const frontendUrl = env.get('FRONTEND_URL')

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard`,
    })

    return session.url
  }

  /**
   * Vérifie la signature du webhook
   */
  static constructEvent(payload: string, signature: string): Stripe.Event {
    const webhookSecret = env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET non configuré')
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  }

  /**
   * Gère les événements webhook de Stripe avec idempotence et transactions
   * 🔄 Idempotence : Vérifie que l'événement n'a pas déjà été traité
   * ⚛️ Atomicité : Tout se fait dans une transaction DB
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    // 🔄 Vérification d'idempotence - L'événement a-t-il déjà été traité ?
    const existing = await ProcessedEvent.findBy('stripeEventId', event.id)
    if (existing) {
      console.log(`[Idempotence] Event ${event.id} already processed, skipping`)
      return
    }

    // ⚛️ Traitement atomique dans une transaction
    await db.transaction(async (trx) => {
      // Marquer comme traité AVANT le traitement (évite les doublons en cas de crash/retry)
      await ProcessedEvent.create(
        {
          stripeEventId: event.id,
          eventType: event.type,
        },
        { client: trx }
      )

      // Dispatcher vers le handler approprié
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, trx)
          break

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription, trx)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription, trx)
          break

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice, trx)
          break

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice, trx)
          break
      }
    })

    console.log(`[Webhook] Event ${event.id} (${event.type}) processed successfully`)
  }

  // === Handlers privés avec transactions ===

  private static async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    _trx: TransactionClientContract
  ): Promise<void> {
    const userId = session.metadata?.userId
    if (!userId) return

    // L'abonnement sera mis à jour via l'événement subscription.updated
    console.log(`[Checkout] Completed for user ${userId}`)
  }

  /**
   * 🚦 Exclusion mutuelle avec FOR UPDATE pour éviter les race conditions
   */
  private static async handleSubscriptionUpdate(
    subscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    const customerId = subscription.customer as string

    // 🚦 FOR UPDATE verrouille la ligne pendant la transaction
    const user = await User.query({ client: trx })
      .where('stripeCustomerId', customerId)
      .forUpdate()
      .first()

    if (!user) {
      console.log(`[Subscription] No user found for customer ${customerId}`)
      return
    }

    user.stripeSubscriptionId = subscription.id
    user.stripePriceId = subscription.items.data[0]?.price.id || null
    user.subscriptionStatus = subscription.status
    user.currentPeriodStart = DateTime.fromSeconds(subscription.current_period_start)
    user.currentPeriodEnd = DateTime.fromSeconds(subscription.current_period_end)
    user.cancelAtPeriodEnd = subscription.cancel_at_period_end

    // Mettre à jour le plan si abonnement actif
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      user.plan = 'pro'
      user.subscriptionEndsAt = DateTime.fromSeconds(subscription.current_period_end)
    }

    await user.useTransaction(trx).save()
    console.log(`[Subscription] Updated for user ${user.id}: ${subscription.status}`)
  }

  /**
   * 🚦 Exclusion mutuelle avec FOR UPDATE
   */
  private static async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    const customerId = subscription.customer as string

    const user = await User.query({ client: trx })
      .where('stripeCustomerId', customerId)
      .forUpdate()
      .first()

    if (!user) return

    user.subscriptionStatus = 'canceled'
    user.plan = 'free'
    user.stripeSubscriptionId = null

    await user.useTransaction(trx).save()
    console.log(`[Subscription] Canceled for user ${user.id}`)
  }

  /**
   * 🚦 Exclusion mutuelle avec FOR UPDATE
   */
  private static async handlePaymentSucceeded(
    invoice: Stripe.Invoice,
    trx: TransactionClientContract
  ): Promise<void> {
    const customerId = invoice.customer as string

    const user = await User.query({ client: trx })
      .where('stripeCustomerId', customerId)
      .forUpdate()
      .first()

    if (!user) return

    // Reset du compteur mensuel à chaque paiement réussi
    user.invoicesUsedThisMonth = 0
    await user.useTransaction(trx).save()

    console.log(`[Payment] Succeeded for user ${user.id}`)
  }

  /**
   * Handler pour échec de paiement
   */
  private static async handlePaymentFailed(
    invoice: Stripe.Invoice,
    trx: TransactionClientContract
  ): Promise<void> {
    const customerId = invoice.customer as string

    const user = await User.query({ client: trx })
      .where('stripeCustomerId', customerId)
      .forUpdate()
      .first()

    if (!user) return

    // Optionnel : marquer le statut comme "past_due" si pas déjà fait par Stripe
    console.log(`[Payment] Failed for user ${user.id}`)

    // TODO: Envoyer un email de notification
  }
}
