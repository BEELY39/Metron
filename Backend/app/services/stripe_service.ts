import Stripe from 'stripe'
import env from '#start/env'
import User from '#models/user'

const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-12-18.acacia',
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
   * Gère les événements webhook de Stripe
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }
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

  // === Handlers privés ===

  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId
    if (!userId) return

    const user = await User.find(Number(userId))
    if (!user) return

    // L'abonnement sera mis à jour via l'événement subscription.updated
    console.log(`Checkout completed for user ${userId}`)
  }

  private static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string
    const user = await User.findBy('stripe_customer_id', customerId)
    if (!user) return

    user.stripeSubscriptionId = subscription.id
    user.stripePriceId = subscription.items.data[0]?.price.id || null
    user.subscriptionStatus = subscription.status
    user.currentPeriodStart = new Date(subscription.current_period_start * 1000)
    user.currentPeriodEnd = new Date(subscription.current_period_end * 1000)
    user.cancelAtPeriodEnd = subscription.cancel_at_period_end

    // Mettre à jour le plan si abonnement actif
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      user.plan = 'pro'
      user.subscriptionEndsAt = new Date(subscription.current_period_end * 1000)
    }

    await user.save()
    console.log(`Subscription updated for user ${user.id}: ${subscription.status}`)
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string
    const user = await User.findBy('stripe_customer_id', customerId)
    if (!user) return

    user.subscriptionStatus = 'canceled'
    user.plan = 'free'
    user.stripeSubscriptionId = null

    await user.save()
    console.log(`Subscription canceled for user ${user.id}`)
  }

  private static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string
    const user = await User.findBy('stripe_customer_id', customerId)
    if (!user) return

    // Reset du compteur mensuel à chaque paiement réussi
    user.invoicesUsedThisMonth = 0
    await user.save()

    console.log(`Payment succeeded for user ${user.id}`)
  }

  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string
    const user = await User.findBy('stripe_customer_id', customerId)
    if (!user) return

    console.log(`Payment failed for user ${user.id}`)
    // Tu peux envoyer un email ici
  }
}
