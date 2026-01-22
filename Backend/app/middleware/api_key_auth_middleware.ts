import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiKey from '#models/api_key'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'

/**
 * Middleware d'authentification par clé API
 *
 * Vérifie que la requête contient une clé API valide dans le header:
 * Authorization: Bearer mk_live_xxxxxxxxxxxxx
 *
 * ou
 *
 * X-API-Key: mk_live_xxxxxxxxxxxxx
 */
export default class ApiKeyAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx

    // 1. Récupérer la clé API depuis les headers
    const apiKey = this.extractApiKey(request)

    if (!apiKey) {
      return response.status(401).send({
        error: 'Clé API manquante',
        message: 'Fournissez une clé API via le header Authorization ou X-API-Key',
      })
    }

    // 2. Vérifier le format de la clé (doit commencer par mk_live_)
    if (!apiKey.startsWith('mk_live_')) {
      return response.status(401).send({
        error: 'Format de clé API invalide',
      })
    }

    // 3. Extraire le préfixe pour recherche rapide
    const prefix = apiKey.substring(0, 12)

    // 4. Chercher les clés correspondant au préfixe
    const potentialKeys = await ApiKey.query()
      .where('keyPrefix', prefix)
      .where('isActive', true)
      .preload('user')

    // 5. Vérifier chaque clé potentielle (comparer le hash)
    let validApiKey: ApiKey | null = null

    for (const key of potentialKeys) {
      const isValid = await hash.verify(key.key, apiKey)
      if (isValid) {
        validApiKey = key
        break
      }
    }

    if (!validApiKey) {
      return response.status(401).send({
        error: 'Clé API invalide',
      })
    }

    // 6. Vérifier si la clé a expiré
    if (validApiKey.expiresAt && validApiKey.expiresAt < DateTime.now()) {
      return response.status(401).send({
        error: 'Clé API expirée',
      })
    }

    // 7. Vérifier si l'utilisateur est actif
    if (!validApiKey.user.isActive) {
      return response.status(403).send({
        error: 'Compte utilisateur désactivé',
      })
    }

    // 8. Mettre à jour lastUsedAt (en arrière-plan, sans bloquer)
    validApiKey.lastUsedAt = DateTime.now()
    validApiKey.save().catch(() => {}) // Ignorer les erreurs de mise à jour

    // 9. Stocker l'utilisateur et la clé dans le contexte pour usage ultérieur
    ctx.apiKey = validApiKey
    ctx.apiKeyUser = validApiKey.user

    // 10. Continuer vers la route
    return next()
  }

  /**
   * Extrait la clé API depuis les headers de la requête
   */
  private extractApiKey(request: HttpContext['request']): string | null {
    // Méthode 1: Header Authorization: Bearer <key>
    const authHeader = request.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // Méthode 2: Header X-API-Key: <key>
    const xApiKey = request.header('X-API-Key')
    if (xApiKey) {
      return xApiKey
    }

    return null
  }
}

// Déclaration de type pour étendre HttpContext
declare module '@adonisjs/core/http' {
  interface HttpContext {
    apiKey?: ApiKey
    apiKeyUser?: ApiKey['user']
  }
}
