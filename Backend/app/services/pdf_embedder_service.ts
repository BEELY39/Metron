import { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, PDFString } from 'pdf-lib'

/**
 * Service d'embarquement XML Factur-X dans un PDF
 *
 * Embarque le fichier XML Factur-X dans un PDF existant pour créer
 * un PDF Factur-X conforme.
 *
 * Note: Pour une conformité PDF/A-3 complète, le PDF source doit déjà
 * être au format PDF/A-3 ou PDF/A-3b. Ce service ajoute le XML en tant
 * que pièce jointe avec les métadonnées requises.
 */
export class PdfEmbedderService {
  // Nom du fichier XML embarqué (obligatoire pour Factur-X)
  private readonly XML_FILENAME = 'factur-x.xml'

  /**
   * Embarque le XML Factur-X dans un PDF
   * @param pdfBuffer - Le PDF source en tant que Buffer ou Uint8Array
   * @param xmlContent - Le contenu XML Factur-X à embarquer
   * @returns Le PDF avec le XML embarqué en tant que Uint8Array
   */
  async embedXmlInPdf(pdfBuffer: Buffer | Uint8Array, xmlContent: string): Promise<Uint8Array> {
    // Charger le PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer)

    // Convertir le XML en bytes
    const xmlBytes = new TextEncoder().encode(xmlContent)

    // Embarquer le fichier XML comme pièce jointe
    await pdfDoc.attach(xmlBytes, this.XML_FILENAME, {
      mimeType: 'text/xml',
      description: 'Factur-X XML Invoice',
      creationDate: new Date(),
      modificationDate: new Date(),
    })

    // Ajouter les métadonnées AF (Associated Files) requises pour Factur-X
    this.addAssociatedFilesMetadata(pdfDoc)

    // Sauvegarder et retourner le PDF modifié
    return await pdfDoc.save()
  }

  /**
   * Ajoute les métadonnées Associated Files (AF) au PDF
   * Ces métadonnées sont requises pour la conformité Factur-X
   */
  private addAssociatedFilesMetadata(pdfDoc: PDFDocument): void {
    const catalog = pdfDoc.catalog

    // Récupérer le dictionnaire Names
    const namesDict = catalog.lookup(PDFName.of('Names'))

    if (namesDict instanceof PDFDict) {
      // Récupérer EmbeddedFiles
      const embeddedFiles = namesDict.lookup(PDFName.of('EmbeddedFiles'))

      if (embeddedFiles instanceof PDFDict) {
        const namesArray = embeddedFiles.lookup(PDFName.of('Names'))

        if (namesArray instanceof PDFArray) {
          // Chercher la référence du fichier factur-x.xml
          for (let i = 0; i < namesArray.size(); i += 2) {
            const nameObj = namesArray.get(i)
            if (nameObj instanceof PDFHexString || nameObj instanceof PDFString) {
              const name = nameObj.decodeText()
              if (name === this.XML_FILENAME) {
                const fileSpecRef = namesArray.get(i + 1)

                if (fileSpecRef) {
                  // Créer le tableau AF (Associated Files) avec la référence
                  const afArray = pdfDoc.context.obj([fileSpecRef])

                  // Ajouter AF au catalog
                  catalog.set(PDFName.of('AF'), afArray)

                  // Récupérer le filespec et ajouter AFRelationship
                  const fileSpec = pdfDoc.context.lookup(fileSpecRef)
                  if (fileSpec instanceof PDFDict) {
                    // AFRelationship = /Data (le XML est la donnée source)
                    // Autres valeurs possibles: /Source, /Alternative, /Supplement
                    fileSpec.set(PDFName.of('AFRelationship'), PDFName.of('Data'))
                  }
                }
                break
              }
            }
          }
        }
      }
    }
  }

  /**
   * Vérifie si un PDF contient déjà un fichier Factur-X embarqué
   * @param pdfBuffer - Le PDF à vérifier
   * @returns true si le PDF contient déjà un fichier factur-x.xml
   */
  async hasFacturXAttachment(pdfBuffer: Buffer | Uint8Array): Promise<boolean> {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const catalog = pdfDoc.catalog
    const namesDict = catalog.lookup(PDFName.of('Names'))

    if (namesDict instanceof PDFDict) {
      const embeddedFiles = namesDict.lookup(PDFName.of('EmbeddedFiles'))

      if (embeddedFiles instanceof PDFDict) {
        const namesArray = embeddedFiles.lookup(PDFName.of('Names'))

        if (namesArray instanceof PDFArray) {
          for (let i = 0; i < namesArray.size(); i += 2) {
            const nameObj = namesArray.get(i)
            if (nameObj instanceof PDFHexString || nameObj instanceof PDFString) {
              const name = nameObj.decodeText()
              if (name === this.XML_FILENAME) {
                return true
              }
            }
          }
        }
      }
    }

    return false
  }

  /**
   * Extrait le XML Factur-X d'un PDF s'il existe
   * @param pdfBuffer - Le PDF contenant le XML
   * @returns Le contenu XML ou null si non trouvé
   */
  async extractFacturXXml(pdfBuffer: Buffer | Uint8Array): Promise<string | null> {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const catalog = pdfDoc.catalog
    const namesDict = catalog.lookup(PDFName.of('Names'))

    if (namesDict instanceof PDFDict) {
      const embeddedFiles = namesDict.lookup(PDFName.of('EmbeddedFiles'))

      if (embeddedFiles instanceof PDFDict) {
        const namesArray = embeddedFiles.lookup(PDFName.of('Names'))

        if (namesArray instanceof PDFArray) {
          for (let i = 0; i < namesArray.size(); i += 2) {
            const nameObj = namesArray.get(i)
            if (nameObj instanceof PDFHexString || nameObj instanceof PDFString) {
              const name = nameObj.decodeText()
              if (name === this.XML_FILENAME) {
                const fileSpecRef = namesArray.get(i + 1)
                const fileSpec = pdfDoc.context.lookup(fileSpecRef)

                if (fileSpec instanceof PDFDict) {
                  const efDict = fileSpec.lookup(PDFName.of('EF'))

                  if (efDict instanceof PDFDict) {
                    const streamRef = efDict.lookup(PDFName.of('F'))
                    const stream = pdfDoc.context.lookup(streamRef)

                    if (stream && 'getContents' in stream) {
                      const contents = (stream as { getContents: () => Uint8Array }).getContents()
                      return new TextDecoder().decode(contents)
                    }
                  }
                }
                break
              }
            }
          }
        }
      }
    }

    return null
  }
}
