import type { HttpContext } from '@adonisjs/core/http'
import { StripeService } from '#services/stripe_service'
import User from '#models/user'

export default class PaymentsController {
  /**
   * Crée une session de checkout Stripe pour l'abonnement Pro
   * POST /api/payments/checkout
   */
  async createCheckout({ auth, response }: HttpContext) {
    const user = auth.user as User

    // Vérifier si déjà abonné
    if (user.plan === 'pro' && user.subscriptionStatus === 'active') {
      return response.badRequest({
        error: 'Vous avez déjà un abonnement Pro actif',
        code: 'ALREADY_SUBSCRIBED',
      })
    }

    try {
      const checkoutUrl = await StripeService.createCheckoutSession(user)
      return response.ok({ url: checkoutUrl })
    } catch (error) {
      console.error('Checkout error:', error)
      return response.internalServerError({
        error: 'Erreur lors de la création du checkout',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Crée une session de portail client Stripe
   * POST /api/payments/portal
   */
  async createPortal({ auth, response }: HttpContext) {
    const user = auth.user as User

    if (!user.stripeCustomerId) {
      return response.badRequest({
        error: 'Aucun compte de paiement associé',
        code: 'NO_STRIPE_CUSTOMER',
      })
    }

    try {
      const portalUrl = await StripeService.createPortalSession(user)
      return response.ok({ url: portalUrl })
    } catch (error) {
      console.error('Portal error:', error)
      return response.internalServerError({
        error: 'Erreur lors de la création du portail',
      })
    }
  }

  /**
   * Récupère le statut de l'abonnement
   * GET /api/payments/subscription
   */
  async getSubscription({ auth, response }: HttpContext) {
    const user = auth.user as User

    return response.ok({
      plan: user.plan,
      status: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      invoicesUsedThisMonth: user.invoicesUsedThisMonth,
      quotaLimit: user.plan === 'pro' ? 10000 : 1,
    })
  }

  /**
   * Webhook Stripe - reçoit les événements
   * POST /api/payments/webhook
   */
  async webhook({ request, response }: HttpContext) {
    const signature = request.header('stripe-signature')

    if (!signature) {
      return response.badRequest({ error: 'Missing stripe-signature header' })
    }

    try {
      // Récupérer le body brut pour la vérification de signature
      const rawBody = request.raw()
      if (!rawBody) {
        return response.badRequest({ error: 'Empty request body' })
      }

      const event = StripeService.constructEvent(rawBody, signature)
      await StripeService.handleWebhookEvent(event)

      return response.ok({ received: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return response.badRequest({
        error: 'Webhook verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
