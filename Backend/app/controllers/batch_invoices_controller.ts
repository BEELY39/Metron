import type { HttpContext } from '@adonisjs/core/http'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import BatchJob from '#models/batch_job'
import { BatchProcessorService } from '#services/batch_processor_service'
import app from '@adonisjs/core/services/app'

/**
 * Controller pour le traitement batch des factures
 *
 * Endpoints:
 * - POST /api/invoices/batch - Soumettre un nouveau batch
 * - GET /api/invoices/batch/:jobId - Obtenir le statut d'un batch
 * - GET /api/invoices/batch/:jobId/download - Télécharger le résultat
 * - DELETE /api/invoices/batch/:jobId - Annuler un batch
 */
export default class BatchInvoicesController {
  /**
   * Soumettre un nouveau batch de factures
   * POST /api/invoices/batch
   *
   * Body (multipart/form-data):
   * - invoices: fichier ZIP contenant les PDFs
   * - metadata: fichier CSV contenant les métadonnées
   */
  async submit({ request, response }: HttpContext) {
    const user = request.ctx!.apiKeyUser!
    const apiKey = request.ctx!.apiKey!

    // 1. Récupérer les fichiers
    const invoicesZip = request.file('invoices', {
      extnames: ['zip'],
      size: '500mb', // Max 500MB pour le ZIP
    })

    const metadataCsv = request.file('metadata', {
      extnames: ['csv'],
      size: '10mb',
    })

    if (!invoicesZip) {
      return response.status(400).send({
        error: 'Fichier ZIP des factures requis',
        code: 'MISSING_ZIP',
      })
    }

    if (!metadataCsv) {
      return response.status(400).send({
        error: 'Fichier CSV des métadonnées requis',
        code: 'MISSING_CSV',
      })
    }

    // Vérifier les erreurs de validation des fichiers
    if (!invoicesZip.isValid) {
      return response.status(400).send({
        error: invoicesZip.errors[0]?.message || 'Fichier ZIP invalide',
        code: 'INVALID_ZIP',
      })
    }

    if (!metadataCsv.isValid) {
      return response.status(400).send({
        error: metadataCsv.errors[0]?.message || 'Fichier CSV invalide',
        code: 'INVALID_CSV',
      })
    }

    try {
      // 2. Créer le dossier temporaire pour ce batch
      const batchId = randomUUID()
      const tempDir = app.tmpPath('batches', batchId)
      await mkdir(tempDir, { recursive: true })

      // 3. Déplacer les fichiers vers le dossier temporaire
      const zipPath = join(tempDir, 'invoices.zip')
      const csvPath = join(tempDir, 'metadata.csv')

      await invoicesZip.move(tempDir, { name: 'invoices.zip' })
      await metadataCsv.move(tempDir, { name: 'metadata.csv' })

      // 4. Estimer le nombre de factures (on parsera le CSV plus tard)
      // Pour l'instant, on met une estimation basée sur la taille du ZIP
      const zipStats = await stat(zipPath)
      const estimatedInvoices = Math.min(10000, Math.max(1, Math.floor(zipStats.size / 50000))) // ~50KB par PDF

      // 5. Créer le job en base
      const job = await BatchJob.createJob({
        userId: user.id,
        apiKeyId: apiKey.id,
        totalInvoices: estimatedInvoices,
        inputZipPath: zipPath,
        metadataCsvPath: csvPath,
        ipAddress: request.ip(),
        userAgent: request.header('User-Agent'),
      })

      // 6. Lancer le traitement en arrière-plan
      this.processInBackground(job)

      // 7. Retourner l'ID du job
      return response.status(202).send({
        message: 'Batch soumis avec succès. Le traitement est en cours.',
        jobId: job.publicId,
        status: job.status,
        estimatedInvoices: estimatedInvoices,
        statusUrl: `/api/invoices/batch/${job.publicId}`,
      })
    } catch (error) {
      console.error('Erreur lors de la soumission du batch:', error)
      return response.status(500).send({
        error: 'Erreur lors de la soumission du batch',
        code: 'SUBMISSION_ERROR',
      })
    }
  }

  /**
   * Traiter le batch en arrière-plan
   */
  private async processInBackground(job: BatchJob): Promise<void> {
    try {
      const processor = new BatchProcessorService()
      await processor.processJob(job)
    } catch (error) {
      console.error(`Erreur lors du traitement du batch ${job.publicId}:`, error)
      await job.markFailed(error instanceof Error ? error.message : 'Erreur inconnue')
    }
  }

  /**
   * Obtenir le statut d'un batch
   * GET /api/invoices/batch/:jobId
   */
  async status({ request, response, params }: HttpContext) {
    const user = request.ctx!.apiKeyUser!
    const jobId = params.jobId

    const job = await BatchJob.query()
      .where('publicId', jobId)
      .where('userId', user.id)
      .first()

    if (!job) {
      return response.status(404).send({
        error: 'Batch non trouvé',
        code: 'JOB_NOT_FOUND',
      })
    }

    return response.send(job.toPublicJSON())
  }

  /**
   * Télécharger le résultat d'un batch
   * GET /api/invoices/batch/:jobId/download
   */
  async download({ request, response, params }: HttpContext) {
    const user = request.ctx!.apiKeyUser!
    const jobId = params.jobId

    const job = await BatchJob.query()
      .where('publicId', jobId)
      .where('userId', user.id)
      .first()

    if (!job) {
      return response.status(404).send({
        error: 'Batch non trouvé',
        code: 'JOB_NOT_FOUND',
      })
    }

    if (job.status !== 'completed') {
      return response.status(400).send({
        error: 'Le batch n\'est pas encore terminé',
        code: 'JOB_NOT_COMPLETED',
        status: job.status,
        progress: job.progress,
      })
    }

    if (!job.isDownloadValid()) {
      return response.status(410).send({
        error: 'Le lien de téléchargement a expiré',
        code: 'DOWNLOAD_EXPIRED',
        expiredAt: job.downloadExpiresAt?.toISO(),
      })
    }

    if (!job.outputZipPath) {
      return response.status(500).send({
        error: 'Fichier de sortie non disponible',
        code: 'OUTPUT_NOT_FOUND',
      })
    }

    // Stream le fichier
    const filename = `facturx-batch-${job.publicId}.zip`

    response.header('Content-Type', 'application/zip')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    response.header('Content-Length', String(job.outputSizeBytes || 0))

    return response.stream(createReadStream(job.outputZipPath))
  }

  /**
   * Annuler un batch en cours
   * DELETE /api/invoices/batch/:jobId
   */
  async cancel({ request, response, params }: HttpContext) {
    const user = request.ctx!.apiKeyUser!
    const jobId = params.jobId

    const job = await BatchJob.query()
      .where('publicId', jobId)
      .where('userId', user.id)
      .first()

    if (!job) {
      return response.status(404).send({
        error: 'Batch non trouvé',
        code: 'JOB_NOT_FOUND',
      })
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return response.status(400).send({
        error: 'Ce batch ne peut plus être annulé',
        code: 'CANNOT_CANCEL',
        status: job.status,
      })
    }

    await job.cancel()

    return response.send({
      message: 'Batch annulé',
      jobId: job.publicId,
      status: job.status,
    })
  }

  /**
   * Lister les batchs de l'utilisateur
   * GET /api/invoices/batch
   */
  async list({ request, response }: HttpContext) {
    const user = request.ctx!.apiKeyUser!

    const page = request.input('page', 1)
    const limit = Math.min(request.input('limit', 20), 100)

    const jobs = await BatchJob.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)

    return response.send({
      data: jobs.all().map((job) => job.toPublicJSON()),
      meta: {
        total: jobs.total,
        perPage: jobs.perPage,
        currentPage: jobs.currentPage,
        lastPage: jobs.lastPage,
      },
    })
  }
}
