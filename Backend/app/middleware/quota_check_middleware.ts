import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware de vérification des quotas
 *
 * Vérifie que l'utilisateur a le droit de générer des factures
 * selon son plan et son utilisation actuelle.
 *
 * Doit être utilisé APRÈS le middleware apiKeyAuth qui injecte apiKeyUser dans le contexte.
 */
export default class QuotaCheckMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: { type?: 'single' | 'batch' }) {
    const { response, request } = ctx

    // Récupérer l'utilisateur depuis le contexte (injecté par apiKeyAuth)
    const user = ctx.apiKeyUser

    if (!user) {
      return response.status(401).send({
        error: 'Utilisateur non authentifié',
        code: 'UNAUTHENTICATED',
      })
    }

    // Déterminer le nombre de factures demandées
    let invoiceCount = 1

    if (options?.type === 'batch') {
      // Pour les batchs, on vérifie le header ou le body
      const countHeader = request.header('X-Invoice-Count')
      if (countHeader) {
        invoiceCount = parseInt(countHeader, 10)
      }

      // Limite max pour batch: 10 000
      if (invoiceCount > 10000) {
        return response.status(400).send({
          error: 'Le nombre maximum de factures par batch est de 10 000',
          code: 'BATCH_LIMIT_EXCEEDED',
          maxAllowed: 10000,
          requested: invoiceCount,
        })
      }
    }

    // Vérifier si l'utilisateur peut générer ces factures
    const check = user.canGenerateInvoices(invoiceCount)

    if (!check.allowed) {
      return response.status(403).send({
        error: check.reason,
        code: 'QUOTA_EXCEEDED',
        plan: user.plan,
        invoicesUsedThisMonth: user.invoicesUsedThisMonth,
        creditBalance: user.creditBalance / 100, // en euros
        hasActiveSubscription: user.hasActiveSubscription(),
      })
    }

    // Stocker le nombre de factures dans le contexte pour le controller
    ctx.invoiceCount = invoiceCount

    // Continuer
    return next()
  }
}

// Déclaration de type pour étendre HttpContext
declare module '@adonisjs/core/http' {
  interface HttpContext {
    invoiceCount?: number
  }
}
