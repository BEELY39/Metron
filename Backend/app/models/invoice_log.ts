import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import ApiKey from './api_key.js'

export type InvoiceLogType = 'single' | 'batch'
export type InvoiceLogStatus = 'pending' | 'processing' | 'completed' | 'failed'

export default class InvoiceLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare apiKeyId: number | null

  @column()
  declare batchJobId: number | null

  @column()
  declare type: InvoiceLogType

  @column()
  declare invoiceCount: number

  @column()
  declare costCents: number

  @column()
  declare status: InvoiceLogStatus

  @column()
  declare errorMessage: string | null

  @column()
  declare metadata: Record<string, any> | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare completedAt: DateTime | null

  // Relations
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => ApiKey)
  declare apiKey: BelongsTo<typeof ApiKey>

  /**
   * Crée un log pour une facture unitaire
   */
  static async logSingleInvoice(params: {
    userId: number
    apiKeyId: number
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, any>
  }): Promise<InvoiceLog> {
    return await InvoiceLog.create({
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      type: 'single',
      invoiceCount: 1,
      costCents: 10, // 10 centimes
      status: 'pending',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
    })
  }

  /**
   * Crée un log pour un batch
   */
  static async logBatchInvoice(params: {
    userId: number
    apiKeyId: number
    batchJobId: number
    invoiceCount: number
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, any>
  }): Promise<InvoiceLog> {
    return await InvoiceLog.create({
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      batchJobId: params.batchJobId,
      type: 'batch',
      invoiceCount: params.invoiceCount,
      costCents: params.invoiceCount * 10, // 10 centimes par facture
      status: 'pending',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
    })
  }

  /**
   * Marque le log comme complété
   */
  async markCompleted(): Promise<void> {
    this.status = 'completed'
    this.completedAt = DateTime.now()
    await this.save()
  }

  /**
   * Marque le log comme échoué
   */
  async markFailed(errorMessage: string): Promise<void> {
    this.status = 'failed'
    this.errorMessage = errorMessage
    this.completedAt = DateTime.now()
    await this.save()
  }
}
