import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Stocke les événements Stripe déjà traités pour garantir l'idempotence.
 * Empêche le traitement en double si Stripe renvoie le même webhook.
 */
export default class ProcessedEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare stripeEventId: string

  @column()
  declare eventType: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
