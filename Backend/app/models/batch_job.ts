import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import User from './user.js'
import ApiKey from './api_key.js'

export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export default class BatchJob extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare publicId: string

  @column()
  declare userId: number

  @column()
  declare apiKeyId: number | null

  @column()
  declare status: BatchJobStatus

  @column()
  declare totalInvoices: number

  @column()
  declare processedInvoices: number

  @column()
  declare failedInvoices: number

  @column()
  declare progress: number

  @column()
  declare inputZipPath: string | null

  @column()
  declare metadataCsvPath: string | null

  @column()
  declare outputZipPath: string | null

  @column()
  declare outputSizeBytes: number | null

  @column()
  declare downloadUrl: string | null

  @column.dateTime()
  declare downloadExpiresAt: DateTime | null

  @column()
  declare totalCostCents: number

  @column()
  declare errorMessage: string | null

  @column()
  declare errorsDetail: Array<{ filename: string; error: string }> | null

  @column()
  declare metadata: Record<string, any> | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  // Relations
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => ApiKey)
  declare apiKey: BelongsTo<typeof ApiKey>

  /**
   * Crée un nouveau job de batch
   */
  static async createJob(params: {
    userId: number
    apiKeyId: number
    totalInvoices: number
    inputZipPath: string
    metadataCsvPath: string
    ipAddress?: string
    userAgent?: string
  }): Promise<BatchJob> {
    return await BatchJob.create({
      publicId: randomUUID(),
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      status: 'pending',
      totalInvoices: params.totalInvoices,
      processedInvoices: 0,
      failedInvoices: 0,
      progress: 0,
      inputZipPath: params.inputZipPath,
      metadataCsvPath: params.metadataCsvPath,
      totalCostCents: params.totalInvoices * 10,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  }

  /**
   * Démarre le traitement
   */
  async startProcessing(): Promise<void> {
    this.status = 'processing'
    this.startedAt = DateTime.now()
    await this.save()
  }

  /**
   * Met à jour la progression
   */
  async updateProgress(processed: number, failed: number = 0): Promise<void> {
    this.processedInvoices = processed
    this.failedInvoices = failed
    this.progress = Math.round((processed / this.totalInvoices) * 100)
    await this.save()
  }

  /**
   * Marque le job comme complété
   */
  async markCompleted(outputZipPath: string, outputSizeBytes: number): Promise<void> {
    this.status = 'completed'
    this.outputZipPath = outputZipPath
    this.outputSizeBytes = outputSizeBytes
    this.progress = 100
    this.completedAt = DateTime.now()

    // URL de téléchargement expire dans 24h
    this.downloadExpiresAt = DateTime.now().plus({ hours: 24 })

    await this.save()
  }

  /**
   * Marque le job comme échoué
   */
  async markFailed(errorMessage: string, errorsDetail?: Array<{ filename: string; error: string }>): Promise<void> {
    this.status = 'failed'
    this.errorMessage = errorMessage
    this.errorsDetail = errorsDetail || null
    this.completedAt = DateTime.now()
    await this.save()
  }

  /**
   * Annule le job
   */
  async cancel(): Promise<void> {
    this.status = 'cancelled'
    this.completedAt = DateTime.now()
    await this.save()
  }

  /**
   * Vérifie si le téléchargement est encore valide
   */
  isDownloadValid(): boolean {
    if (this.status !== 'completed') return false
    if (!this.downloadExpiresAt) return false
    return this.downloadExpiresAt > DateTime.now()
  }

  /**
   * Retourne les infos publiques du job (pour l'API)
   */
  toPublicJSON(): Record<string, any> {
    return {
      jobId: this.publicId,
      status: this.status,
      totalInvoices: this.totalInvoices,
      processedInvoices: this.processedInvoices,
      failedInvoices: this.failedInvoices,
      progress: this.progress,
      totalCost: `${(this.totalCostCents / 100).toFixed(2)}€`,
      createdAt: this.createdAt.toISO(),
      startedAt: this.startedAt?.toISO() || null,
      completedAt: this.completedAt?.toISO() || null,
      downloadAvailable: this.isDownloadValid(),
      downloadExpiresAt: this.downloadExpiresAt?.toISO() || null,
      errorMessage: this.errorMessage,
      errorsDetail: this.errorsDetail,
    }
  }
}
