import vine from '@vinejs/vine'

/**
 * Validator pour l'inscription
 */
export const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(100),
    email: vine
      .string()
      .email()
      .normalizeEmail(),
    password: vine
      .string()
      .minLength(8)
      .maxLength(64),
  })
)

/**
 * Validator pour la connexion
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

/**
 * Validator pour la création d'une clé API
 */
export const createApiKeyValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(100), // Nom descriptif de la clé
  })
)
