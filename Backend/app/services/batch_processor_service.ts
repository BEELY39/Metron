import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { parse } from 'csv-parse'
import archiver from 'archiver'
import { Extract } from 'unzipper'
import { XmlGeneratorService } from './xml_generator_service.js'
import { PdfEmbedderService } from './pdf_embedder_service.js'
import BatchJob from '#models/batch_job'
import InvoiceLog from '#models/invoice_log'
import User from '#models/user'
import app from '@adonisjs/core/services/app'

export interface BatchInvoiceMetadata {
  filename: string
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  sellerSiret: string
  sellerVatNumber?: string
  sellerStreet?: string
  sellerZipCode?: string
  sellerCity?: string
  sellerCountryCode: string
  buyerName: string
  buyerSiret?: string
  buyerVatNumber?: string
  buyerStreet?: string
  buyerZipCode?: string
  buyerCity?: string
  buyerCountryCode: string
  currencyCode: string
  totalHT: string
  totalTVA: string
  totalTTC: string
  paymentTerms?: string
  paymentDueDate?: string
}

export interface BatchProcessingResult {
  success: boolean
  totalProcessed: number
  totalFailed: number
  outputZipPath?: string
  outputSizeBytes?: number
  errors: Array<{ filename: string; error: string }>
}

/**
 * Service de traitement des batchs de factures
 *
 * Gère l'extraction des ZIP, le parsing CSV, la génération des factures
 * et la création du ZIP de sortie.
 */
export class BatchProcessorService {
  private xmlGenerator: XmlGeneratorService
  private pdfEmbedder: PdfEmbedderService
  private tempDir: string

  constructor() {
    this.xmlGenerator = new XmlGeneratorService()
    this.pdfEmbedder = new PdfEmbedderService()
    this.tempDir = app.tmpPath('batches')
  }

  /**
   * Traite un job de batch complet
   */
  async processJob(job: BatchJob): Promise<BatchProcessingResult> {
    const jobDir = join(this.tempDir, job.publicId)
    const inputDir = join(jobDir, 'input')
    const outputDir = join(jobDir, 'output')

    try {
      // Créer les dossiers de travail
      await mkdir(inputDir, { recursive: true })
      await mkdir(outputDir, { recursive: true })

      // Marquer le job comme en cours
      await job.startProcessing()

      // 1. Extraire le ZIP d'entrée
      await this.extractZip(job.inputZipPath!, inputDir)

      // 2. Parser le CSV de métadonnées
      const metadata = await this.parseCsv(job.metadataCsvPath!)

      // Vérifier la limite
      if (metadata.length > 10000) {
        throw new Error(`Le batch contient ${metadata.length} factures. Maximum autorisé: 10000`)
      }

      // Mettre à jour le total si différent
      if (metadata.length !== job.totalInvoices) {
        job.totalInvoices = metadata.length
        job.totalCostCents = metadata.length * 10
        await job.save()
      }

      // 3. Traiter chaque facture
      const errors: Array<{ filename: string; error: string }> = []
      let processed = 0

      for (const invoiceData of metadata) {
        try {
          await this.processInvoice(invoiceData, inputDir, outputDir)
          processed++
        } catch (error) {
          errors.push({
            filename: invoiceData.filename,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          })
        }

        // Mettre à jour la progression tous les 10 fichiers
        if (processed % 10 === 0 || errors.length % 10 === 0) {
          await job.updateProgress(processed, errors.length)
        }
      }

      // 4. Créer le ZIP de sortie
      const outputZipPath = join(jobDir, `facturx-${job.publicId}.zip`)
      const outputSizeBytes = await this.createOutputZip(outputDir, outputZipPath)

      // 5. Finaliser le job
      if (errors.length === metadata.length) {
        // Toutes les factures ont échoué
        await job.markFailed('Toutes les factures ont échoué', errors)
      } else {
        await job.markCompleted(outputZipPath, outputSizeBytes)
        if (errors.length > 0) {
          job.errorsDetail = errors
          await job.save()
        }
      }

      // 6. Facturer l'utilisateur pour les factures traitées
      const user = await User.find(job.userId)
      if (user) {
        await user.chargeForInvoices(processed)
      }

      // 7. Logger l'usage
      await InvoiceLog.logBatchInvoice({
        userId: job.userId,
        apiKeyId: job.apiKeyId!,
        batchJobId: job.id,
        invoiceCount: processed,
        ipAddress: job.ipAddress || undefined,
        userAgent: job.userAgent || undefined,
        metadata: { failedCount: errors.length },
      })

      // Nettoyer les fichiers temporaires (input seulement)
      await this.cleanup(inputDir)
      if (job.inputZipPath) await rm(job.inputZipPath, { force: true })
      if (job.metadataCsvPath) await rm(job.metadataCsvPath, { force: true })

      return {
        success: errors.length < metadata.length,
        totalProcessed: processed,
        totalFailed: errors.length,
        outputZipPath,
        outputSizeBytes,
        errors,
      }
    } catch (error) {
      await job.markFailed(error instanceof Error ? error.message : 'Erreur inconnue')

      // Nettoyer en cas d'erreur
      await this.cleanup(jobDir)

      return {
        success: false,
        totalProcessed: 0,
        totalFailed: job.totalInvoices,
        errors: [{ filename: '*', error: error instanceof Error ? error.message : 'Erreur inconnue' }],
      }
    }
  }

  /**
   * Extrait un fichier ZIP
   */
  private async extractZip(zipPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(Extract({ path: outputDir }))
        .on('close', resolve)
        .on('error', reject)
    })
  }

  /**
   * Parse le fichier CSV de métadonnées
   */
  private async parseCsv(csvPath: string): Promise<BatchInvoiceMetadata[]> {
    const records: BatchInvoiceMetadata[] = []

    const parser = createReadStream(csvPath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [',', ';'], // Supporte virgule et point-virgule
      })
    )

    for await (const record of parser) {
      // Mapper les colonnes CSV vers notre structure
      records.push({
        filename: record.filename || record.fichier || record.pdf,
        invoiceNumber: record.invoiceNumber || record.numero || record.invoice_number,
        invoiceDate: record.invoiceDate || record.date || record.invoice_date,
        sellerName: record.sellerName || record.vendeur || record.seller_name,
        sellerSiret: record.sellerSiret || record.siret_vendeur || record.seller_siret,
        sellerVatNumber: record.sellerVatNumber || record.tva_vendeur || record.seller_vat,
        sellerStreet: record.sellerStreet || record.adresse_vendeur || record.seller_street,
        sellerZipCode: record.sellerZipCode || record.cp_vendeur || record.seller_zip,
        sellerCity: record.sellerCity || record.ville_vendeur || record.seller_city,
        sellerCountryCode: record.sellerCountryCode || record.pays_vendeur || record.seller_country || 'FR',
        buyerName: record.buyerName || record.acheteur || record.buyer_name,
        buyerSiret: record.buyerSiret || record.siret_acheteur || record.buyer_siret,
        buyerVatNumber: record.buyerVatNumber || record.tva_acheteur || record.buyer_vat,
        buyerStreet: record.buyerStreet || record.adresse_acheteur || record.buyer_street,
        buyerZipCode: record.buyerZipCode || record.cp_acheteur || record.buyer_zip,
        buyerCity: record.buyerCity || record.ville_acheteur || record.buyer_city,
        buyerCountryCode: record.buyerCountryCode || record.pays_acheteur || record.buyer_country || 'FR',
        currencyCode: record.currencyCode || record.devise || record.currency || 'EUR',
        totalHT: record.totalHT || record.ht || record.total_ht,
        totalTVA: record.totalTVA || record.tva || record.total_tva,
        totalTTC: record.totalTTC || record.ttc || record.total_ttc,
        paymentTerms: record.paymentTerms || record.conditions || record.payment_terms,
        paymentDueDate: record.paymentDueDate || record.echeance || record.due_date,
      })
    }

    return records
  }

  /**
   * Traite une facture individuelle
   */
  private async processInvoice(
    metadata: BatchInvoiceMetadata,
    inputDir: string,
    outputDir: string
  ): Promise<void> {
    // Trouver le fichier PDF (peut être dans un sous-dossier)
    const pdfPath = await this.findPdfFile(inputDir, metadata.filename)

    if (!pdfPath) {
      throw new Error(`Fichier PDF non trouvé: ${metadata.filename}`)
    }

    // Lire le PDF
    const pdfBuffer = await readFile(pdfPath)

    // Vérifier que c'est bien un PDF
    const magic = pdfBuffer.subarray(0, 5).toString('ascii')
    if (magic !== '%PDF-') {
      throw new Error(`Le fichier n'est pas un PDF valide: ${metadata.filename}`)
    }

    // Construire les données pour le XML
    const invoiceData = {
      invoiceNumber: metadata.invoiceNumber,
      invoiceDate: metadata.invoiceDate,
      sellerName: metadata.sellerName,
      sellerSiret: metadata.sellerSiret,
      sellerVatNumber: metadata.sellerVatNumber,
      sellerAddress: {
        street: metadata.sellerStreet,
        zipCode: metadata.sellerZipCode,
        city: metadata.sellerCity,
        countryCode: metadata.sellerCountryCode,
      },
      buyerName: metadata.buyerName,
      buyerSiret: metadata.buyerSiret,
      buyerVatNumber: metadata.buyerVatNumber,
      buyerAddress: {
        street: metadata.buyerStreet,
        zipCode: metadata.buyerZipCode,
        city: metadata.buyerCity,
        countryCode: metadata.buyerCountryCode,
      },
      currencyCode: metadata.currencyCode,
      totalHT: metadata.totalHT,
      totalTVA: metadata.totalTVA,
      totalTTC: metadata.totalTTC,
      paymentTerms: metadata.paymentTerms,
      paymentDueDate: metadata.paymentDueDate,
    }

    // Générer le XML Factur-X
    const xml = await this.xmlGenerator.generateXml(invoiceData)

    // Embarquer le XML dans le PDF
    const facturxPdf = await this.pdfEmbedder.embedXmlInPdf(pdfBuffer, xml)

    // Sauvegarder le résultat
    const outputFilename = `facturx-${metadata.invoiceNumber}.pdf`
    await writeFile(join(outputDir, outputFilename), Buffer.from(facturxPdf))
  }

  /**
   * Trouve un fichier PDF dans un dossier (récursivement)
   */
  private async findPdfFile(dir: string, filename: string): Promise<string | null> {
    // D'abord chercher directement
    const directPath = join(dir, filename)
    if (existsSync(directPath)) {
      return directPath
    }

    // Sinon chercher récursivement
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = await this.findPdfFile(join(dir, entry.name), filename)
        if (found) return found
      } else if (entry.name === filename || entry.name === basename(filename)) {
        return join(dir, entry.name)
      }
    }

    return null
  }

  /**
   * Crée le ZIP de sortie
   */
  private async createOutputZip(sourceDir: string, outputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      let totalSize = 0

      output.on('close', () => resolve(archive.pointer()))
      archive.on('error', reject)

      archive.pipe(output)
      archive.directory(sourceDir, false)
      archive.finalize()
    })
  }

  /**
   * Nettoie un dossier temporaire
   */
  private async cleanup(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true })
    } catch {
      // Ignorer les erreurs de nettoyage
    }
  }

  /**
   * Nettoie les anciens jobs (plus de 24h)
   * À appeler via un cron job
   */
  async cleanupOldJobs(): Promise<number> {
    const jobs = await BatchJob.query()
      .where('status', 'completed')
      .where('completedAt', '<', new Date(Date.now() - 24 * 60 * 60 * 1000))

    let cleaned = 0

    for (const job of jobs) {
      try {
        // Supprimer le ZIP de sortie
        if (job.outputZipPath) {
          await rm(job.outputZipPath, { force: true })
        }

        // Supprimer le dossier du job
        const jobDir = join(this.tempDir, job.publicId)
        await this.cleanup(jobDir)

        // Mettre à jour le job
        job.outputZipPath = null
        job.downloadUrl = null
        await job.save()

        cleaned++
      } catch {
        // Ignorer les erreurs
      }
    }

    return cleaned
  }
}
