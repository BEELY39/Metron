import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Store simple en mémoire pour le rate limiting
 * En production, utiliser Redis pour un environnement multi-instances
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Nettoyage périodique du store (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  // Nombre max de requêtes
  maxRequests: number
  // Fenêtre de temps en secondes
  windowSeconds: number
  // Identifiant custom (par défaut: IP + userId)
  keyPrefix?: string
}

/**
 * Middleware de rate limiting
 *
 * Protège contre les abus en limitant le nombre de requêtes par utilisateur/IP.
 *
 * Configurations recommandées:
 * - Single invoice: 60 req/min
 * - Batch submit: 10 req/min
 * - Batch status: 120 req/min
 */
export default class RateLimitMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: RateLimitOptions = { maxRequests: 60, windowSeconds: 60 }
  ) {
    const { response, request } = ctx

    // Construire la clé unique pour cet utilisateur
    const ip = request.ip()
    const userId = ctx.apiKeyUser?.id || 'anonymous'
    const keyPrefix = options.keyPrefix || 'default'
    const key = `ratelimit:${keyPrefix}:${userId}:${ip}`

    const now = Date.now()
    const windowMs = options.windowSeconds * 1000
    const resetAt = now + windowMs

    // Récupérer ou créer l'entrée
    let entry = rateLimitStore.get(key)

    if (!entry || entry.resetAt < now) {
      // Nouvelle fenêtre
      entry = { count: 1, resetAt }
      rateLimitStore.set(key, entry)
    } else {
      // Incrémenter le compteur
      entry.count++
    }

    // Calculer les headers de rate limit
    const remaining = Math.max(0, options.maxRequests - entry.count)
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

    // Ajouter les headers informatifs
    response.header('X-RateLimit-Limit', String(options.maxRequests))
    response.header('X-RateLimit-Remaining', String(remaining))
    response.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    // Vérifier si la limite est dépassée
    if (entry.count > options.maxRequests) {
      response.header('Retry-After', String(retryAfter))

      return response.status(429).send({
        error: 'Trop de requêtes. Veuillez réessayer plus tard.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfter,
        limit: options.maxRequests,
        windowSeconds: options.windowSeconds,
      })
    }

    // Log si proche de la limite (avertissement)
    if (entry.count > options.maxRequests * 0.8) {
      console.warn(`[RateLimit] User ${userId} approaching limit: ${entry.count}/${options.maxRequests}`)
    }

    return next()
  }
}

/**
 * Factory pour créer des configurations de rate limit
 */
export const rateLimitConfig = {
  // Pour les factures unitaires: 60/min
  single: (): RateLimitOptions => ({
    maxRequests: 60,
    windowSeconds: 60,
    keyPrefix: 'single',
  }),

  // Pour la soumission de batch: 10/min
  batchSubmit: (): RateLimitOptions => ({
    maxRequests: 10,
    windowSeconds: 60,
    keyPrefix: 'batch-submit',
  }),

  // Pour le statut de batch: 120/min
  batchStatus: (): RateLimitOptions => ({
    maxRequests: 120,
    windowSeconds: 60,
    keyPrefix: 'batch-status',
  }),

  // Pour le téléchargement: 30/min
  download: (): RateLimitOptions => ({
    maxRequests: 30,
    windowSeconds: 60,
    keyPrefix: 'download',
  }),

  // Config custom
  custom: (maxRequests: number, windowSeconds: number, keyPrefix: string): RateLimitOptions => ({
    maxRequests,
    windowSeconds,
    keyPrefix,
  }),
}
