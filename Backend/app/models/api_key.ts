import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class ApiKey extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string // Nom descriptif de la clé (ex: "Production", "Test")

  @column({ serializeAs: null }) // Ne jamais exposer la clé hashée
  declare key: string // La clé API hashée

  @column()
  declare keyPrefix: string // Les 12 premiers caractères (pour identification)

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime | null // null = jamais expire

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relation: une clé API appartient à un utilisateur
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * Génère une nouvelle clé API
   * Format: mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (48 chars random hex)
   */
  static generateKey(): { fullKey: string; prefix: string } {
    const randomPart = randomBytes(24).toString('hex') // 48 caractères hex
    const fullKey = `mk_live_${randomPart}`
    const prefix = fullKey.substring(0, 12) // "mk_live_xxxx"
    return { fullKey, prefix }
  }
}
