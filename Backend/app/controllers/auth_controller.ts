import User from '#models/user'
import ApiKey from '#models/api_key'
import hash from '@adonisjs/core/services/hash'
import { registerValidator, loginValidator } from '#validators/auth'
import { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  /**
   * Inscription d'un nouvel utilisateur
   * POST /api/auth/register
   */
  async register({ request, response }: HttpContext) {
    // 1. Valider les données
    const data = await request.validateUsing(registerValidator)

    // 2. Vérifier si l'email existe déjà
    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      return response.status(409).send({
        error: 'Un compte avec cet email existe déjà',
      })
    }

    // 3. Créer l'utilisateur (le mot de passe est hashé automatiquement par le mixin AuthFinder)
    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      isActive: true,
    })

    // 4. Retourner l'utilisateur créé (sans le mot de passe)
    return response.status(201).send({
      message: 'Compte créé avec succès',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
      },
    })
  }

  /**
   * Connexion d'un utilisateur
   * POST /api/auth/login
   */
  async login({ request, response }: HttpContext) {
    // 1. Valider les données
    const { email, password } = await request.validateUsing(loginValidator)

    // 2. Vérifier les credentials avec le mixin AuthFinder
    const user = await User.verifyCredentials(email, password)

    // 3. Vérifier si le compte est actif
    if (!user.isActive) {
      return response.status(403).send({
        error: 'Ce compte a été désactivé',
      })
    }

    // 4. Générer un access token via AdonisJS Auth
    const token = await User.accessTokens.create(user, ['*'], {
      name: 'auth_token',
      expiresIn: '7 days',
    })

    return response.send({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt,
      },
    })
  }

  /**
   * Déconnexion - Révoque le token actuel
   * POST /api/auth/logout
   */
  async logout(ctx: HttpContext) {
    const user = ctx.auth.user!
    const currentToken = ctx.auth.user!.currentAccessToken
    await User.accessTokens.delete(user, currentToken.identifier)

    return ctx.response.send({ message: 'Déconnexion réussie' })
  }

  /**
   * Récupérer la clé API de l'utilisateur (une seule par compte)
   * GET /api/auth/api-keys/me
   */
  async getMyApiKey(ctx: HttpContext) {
    const user = ctx.auth.user!

    const apiKey = await ApiKey.query()
      .where('userId', user.id)
      .where('isActive', true)
      .select(['id', 'name', 'keyPrefix', 'isActive', 'lastUsedAt', 'createdAt'])
      .first()

    return ctx.response.send({
      hasKey: !!apiKey,
      apiKey: apiKey || null,
    })
  }

  /**
   * Générer une clé API (une seule autorisée par compte)
   * POST /api/auth/api-keys/generate
   */
  async generateApiKey(ctx: HttpContext) {
    const user = ctx.auth.user!

    // Vérifier si l'utilisateur a déjà une clé active
    const existingKey = await ApiKey.query()
      .where('userId', user.id)
      .where('isActive', true)
      .first()

    if (existingKey) {
      return ctx.response.status(409).send({
        error: 'Vous avez déjà une clé API active',
        message: 'Révoquez votre clé existante avant d\'en créer une nouvelle',
      })
    }

    // Générer la clé API
    const { fullKey, prefix } = ApiKey.generateKey()

    // Hasher la clé avant de la stocker
    const hashedKey = await hash.make(fullKey)

    // Créer l'entrée en base
    const apiKey = await ApiKey.create({
      userId: user.id,
      name: 'Ma clé API',
      key: hashedKey,
      keyPrefix: prefix,
      isActive: true,
    })

    return ctx.response.status(201).send({
      message: 'Clé API créée avec succès',
      apiKey: {
        id: apiKey.id,
        key: fullKey, // Visible une seule fois !
        keyPrefix: prefix,
        createdAt: apiKey.createdAt,
      },
      warning: 'Conservez cette clé en lieu sûr. Elle ne sera plus affichée.',
    })
  }

  /**
   * Révoquer la clé API de l'utilisateur
   * DELETE /api/auth/api-keys/revoke
   */
  async revokeApiKey(ctx: HttpContext) {
    const user = ctx.auth.user!

    const apiKey = await ApiKey.query()
      .where('userId', user.id)
      .where('isActive', true)
      .first()

    if (!apiKey) {
      return ctx.response.status(404).send({ error: 'Aucune clé API active' })
    }

    apiKey.isActive = false
    await apiKey.save()

    return ctx.response.send({ message: 'Clé API révoquée avec succès' })
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   * GET /api/auth/me
   */
  async me(ctx: HttpContext) {
    const user = ctx.auth.user!

    return ctx.response.send({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt,
      },
    })
  }
}
