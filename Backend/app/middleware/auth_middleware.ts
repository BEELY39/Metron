import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware d'authentification par Bearer Token
 *
 * Vérifie que la requête contient un token valide dans le header:
 * Authorization: Bearer oat_xxxxxxxxxxxxxxxx
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.authenticate()
    return next()
  }
}
