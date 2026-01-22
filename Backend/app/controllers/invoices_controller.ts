import type { HttpContext } from '@adonisjs/core/http'
import { XmlGeneratorService } from '#services/xml_generator_service'
import { PdfEmbedderService } from '#services/pdf_embedder_service'
import { invoiceValidator } from '#validators/invoice'
import { readFile } from 'node:fs/promises'

export default class InvoicesController {
  async generate({ request, response }: HttpContext): Promise<void> {
    try {
      // 1. Valider les données avec VineJS (validation + typage automatique)
      const invoiceData = await request.validateUsing(invoiceValidator)

      // 2. Récupérer le fichier PDF uploadé
      const pdfFile = request.file('pdf', {
        extnames: ['pdf'],
        size: '10mb',
      })

      if (!pdfFile) {
        response.status(400).send({ error: 'Fichier PDF requis' })
        return
      }

      // 3. Lire le contenu du fichier PDF
      const pdfBuffer = await readFile(pdfFile.tmpPath!)

      // 4. Générer le XML Factur-X
      const xmlGeneratorService = new XmlGeneratorService()
      const xml = await xmlGeneratorService.generateXml(invoiceData)

      // 5. Embarquer le XML dans le PDF (ordre: pdfBuffer, xml)
      const pdfEmbedderService = new PdfEmbedderService()
      const pdfFacturX = await pdfEmbedderService.embedXmlInPdf(pdfBuffer, xml)

      // 6. Retourner le PDF Factur-X
      response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="facture-facturx.pdf"')
        .send(Buffer.from(pdfFacturX))
    } catch (error) {
      console.error(error)
      response.status(500).send({ error: 'Erreur lors de la génération du PDF Factur-X' })
    }
  }
}