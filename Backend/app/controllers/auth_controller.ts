import User from '#models/user'
import ApiKey from '#models/api_key'
import hash from '@adonisjs/core/services/hash'
import { registerValidator, loginValidator, createApiKeyValidator } from '#validators/auth'
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
   * Créer une clé API pour l'utilisateur connecté
   * POST /api/auth/api-keys
   */
  async createApiKey(ctx: HttpContext) {
    // 1. L'utilisateur est déjà authentifié via le middleware
    const user = ctx.auth.user!

    // 2. Valider les données
    const { name } = await ctx.request.validateUsing(createApiKeyValidator)

    // 3. Générer la clé API
    const { fullKey, prefix } = ApiKey.generateKey()

    // 4. Hasher la clé avant de la stocker
    const hashedKey = await hash.make(fullKey)

    // 5. Créer l'entrée en base
    const apiKey = await ApiKey.create({
      userId: user.id,
      name,
      key: hashedKey,
      keyPrefix: prefix,
      isActive: true,
    })

    // 6. Retourner la clé (ATTENTION: c'est la seule fois qu'on la montre en clair!)
    return ctx.response.status(201).send({
      message: 'Clé API créée avec succès',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey, // Montré une seule fois!
        prefix: prefix,
        createdAt: apiKey.createdAt,
      },
      warning: 'Conservez cette clé en lieu sûr. Elle ne sera plus affichée.',
    })
  }

  /**
   * Lister les clés API de l'utilisateur connecté
   * GET /api/auth/api-keys
   */
  async listApiKeys(ctx: HttpContext) {
    const user = ctx.auth.user!

    const apiKeys = await ApiKey.query()
      .where('userId', user.id)
      .select(['id', 'name', 'keyPrefix', 'isActive', 'lastUsedAt', 'createdAt'])

    return ctx.response.send({ apiKeys })
  }

  /**
   * Révoquer une clé API
   * DELETE /api/auth/api-keys/:id
   */
  async revokeApiKey(ctx: HttpContext) {
    const user = ctx.auth.user!

    const apiKey = await ApiKey.query()
      .where('id', ctx.params.id)
      .where('userId', user.id)
      .first()

    if (!apiKey) {
      return ctx.response.status(404).send({ error: 'Clé API non trouvée' })
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
