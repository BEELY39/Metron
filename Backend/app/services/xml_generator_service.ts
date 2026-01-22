import { InvoiceData } from '../types/InvoceData.js'
import { create } from 'xmlbuilder2'

/**
 * Service de génération XML Factur-X
 *
 * Génère un XML conforme à la norme Factur-X (CII - Cross Industry Invoice)
 * Profil supporté : MINIMUM (compatible avec BASIC si lignes fournies)
 *
 * Documentation : https://fnfe-mpe.org/factur-x/
 */
export class XmlGeneratorService {
  // Namespaces Factur-X obligatoires
  private readonly namespaces = {
    rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
    ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
    udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
    qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
  }

  /**
   * Génère le XML Factur-X à partir des données de facture
   * @param invoiceData - Données de la facture
   * @returns XML string conforme Factur-X
   */
  async generateXml(invoiceData: InvoiceData): Promise<string> {
    // Formater la date au format CII (YYYYMMDD)
    const formattedDate = this.formatDateToCII(invoiceData.invoiceDate)

    // Création du document XML avec les namespaces
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele(this.namespaces.rsm, 'rsm:CrossIndustryInvoice')
      .att('xmlns:qdt', this.namespaces.qdt)
      .att('xmlns:ram', this.namespaces.ram)
      .att('xmlns:rsm', this.namespaces.rsm)
      .att('xmlns:udt', this.namespaces.udt)

    // ============================================
    // 1. ExchangedDocumentContext - Contexte du document
    // ============================================
    const context = doc.ele('rsm:ExchangedDocumentContext')

    // Business Process (optionnel mais recommandé)
    context
      .ele('ram:BusinessProcessSpecifiedDocumentContextParameter')
      .ele('ram:ID')
      .txt('A1')
      .up()
      .up()

    // Guideline - Identifie le profil Factur-X (MINIMUM)
    context
      .ele('ram:GuidelineSpecifiedDocumentContextParameter')
      .ele('ram:ID')
      .txt('urn:factur-x.eu:1p0:minimum')
      .up()
      .up()

    context.up()

    // ============================================
    // 2. ExchangedDocument - Informations du document
    // ============================================
    const exchangedDoc = doc.ele('rsm:ExchangedDocument')

    // Numéro de facture
    exchangedDoc.ele('ram:ID').txt(invoiceData.invoiceNumber).up()

    // Type de document (380 = Facture, 381 = Avoir)
    exchangedDoc.ele('ram:TypeCode').txt(invoiceData.invoiceTypeCode || '380').up()

    // Date d'émission au format CII
    exchangedDoc
      .ele('ram:IssueDateTime')
      .ele('udt:DateTimeString')
      .att('format', '102') // Format 102 = YYYYMMDD
      .txt(formattedDate)
      .up()
      .up()

    exchangedDoc.up()

    // ============================================
    // 3. SupplyChainTradeTransaction - Transaction commerciale
    // ============================================
    const transaction = doc.ele('rsm:SupplyChainTradeTransaction')

    // ---- ApplicableHeaderTradeAgreement (Accord commercial) ----
    const agreement = transaction.ele('ram:ApplicableHeaderTradeAgreement')

    // Référence commande client (optionnel)
    if (invoiceData.purchaseOrderReference) {
      agreement
        .ele('ram:BuyerOrderReferencedDocument')
        .ele('ram:IssuerAssignedID')
        .txt(invoiceData.purchaseOrderReference)
        .up()
        .up()
    }

    // --- Vendeur (SellerTradeParty) ---
    const seller = agreement.ele('ram:SellerTradeParty')

    // Nom du vendeur
    seller.ele('ram:Name').txt(invoiceData.sellerName).up()

    // SIRET du vendeur (schemeID 0002 = SIRET français)
    seller
      .ele('ram:SpecifiedLegalOrganization')
      .ele('ram:ID')
      .att('schemeID', '0002')
      .txt(invoiceData.sellerSiret)
      .up()
      .up()

    // Adresse du vendeur
    const sellerAddress = seller.ele('ram:PostalTradeAddress')
    if (invoiceData.sellerAddress.zipCode) {
      sellerAddress.ele('ram:PostcodeCode').txt(invoiceData.sellerAddress.zipCode).up()
    }
    if (invoiceData.sellerAddress.street) {
      sellerAddress.ele('ram:LineOne').txt(invoiceData.sellerAddress.street).up()
    }
    if (invoiceData.sellerAddress.city) {
      sellerAddress.ele('ram:CityName').txt(invoiceData.sellerAddress.city).up()
    }
    sellerAddress.ele('ram:CountryID').txt(invoiceData.sellerAddress.countryCode).up()
    sellerAddress.up()

    // Numéro TVA du vendeur (si fourni)
    if (invoiceData.sellerVatNumber) {
      seller
        .ele('ram:SpecifiedTaxRegistration')
        .ele('ram:ID')
        .att('schemeID', 'VA') // VA = TVA intracommunautaire
        .txt(invoiceData.sellerVatNumber)
        .up()
        .up()
    }

    seller.up()

    // --- Acheteur (BuyerTradeParty) ---
    const buyer = agreement.ele('ram:BuyerTradeParty')

    // Nom de l'acheteur
    buyer.ele('ram:Name').txt(invoiceData.buyerName).up()

    // SIRET de l'acheteur (optionnel)
    if (invoiceData.buyerSiret) {
      buyer
        .ele('ram:SpecifiedLegalOrganization')
        .ele('ram:ID')
        .att('schemeID', '0002')
        .txt(invoiceData.buyerSiret)
        .up()
        .up()
    }

    // Adresse de l'acheteur
    const buyerAddress = buyer.ele('ram:PostalTradeAddress')
    if (invoiceData.buyerAddress.zipCode) {
      buyerAddress.ele('ram:PostcodeCode').txt(invoiceData.buyerAddress.zipCode).up()
    }
    if (invoiceData.buyerAddress.street) {
      buyerAddress.ele('ram:LineOne').txt(invoiceData.buyerAddress.street).up()
    }
    if (invoiceData.buyerAddress.city) {
      buyerAddress.ele('ram:CityName').txt(invoiceData.buyerAddress.city).up()
    }
    buyerAddress.ele('ram:CountryID').txt(invoiceData.buyerAddress.countryCode).up()
    buyerAddress.up()

    // Numéro TVA de l'acheteur (si fourni)
    if (invoiceData.buyerVatNumber) {
      buyer
        .ele('ram:SpecifiedTaxRegistration')
        .ele('ram:ID')
        .att('schemeID', 'VA')
        .txt(invoiceData.buyerVatNumber)
        .up()
        .up()
    }

    buyer.up()
    agreement.up()

    // ---- ApplicableHeaderTradeDelivery (Livraison) ----
    // Élément obligatoire mais peut être vide pour profil MINIMUM
    transaction.ele('ram:ApplicableHeaderTradeDelivery').up()

    // ---- ApplicableHeaderTradeSettlement (Règlement) ----
    const settlement = transaction.ele('ram:ApplicableHeaderTradeSettlement')

    // Code devise
    settlement.ele('ram:InvoiceCurrencyCode').txt(invoiceData.currencyCode).up()

    // Conditions de paiement (optionnel)
    if (invoiceData.paymentTerms || invoiceData.paymentDueDate) {
      const paymentTerms = settlement.ele('ram:SpecifiedTradePaymentTerms')
      if (invoiceData.paymentTerms) {
        paymentTerms.ele('ram:Description').txt(invoiceData.paymentTerms).up()
      }
      if (invoiceData.paymentDueDate) {
        paymentTerms
          .ele('ram:DueDateDateTime')
          .ele('udt:DateTimeString')
          .att('format', '102')
          .txt(this.formatDateToCII(invoiceData.paymentDueDate))
          .up()
          .up()
      }
      paymentTerms.up()
    }

    // ---- Montants totaux (SpecifiedTradeSettlementHeaderMonetarySummation) ----
    const totals = settlement.ele('ram:SpecifiedTradeSettlementHeaderMonetarySummation')

    // Total HT (TaxBasisTotalAmount)
    totals.ele('ram:TaxBasisTotalAmount').txt(this.formatAmount(invoiceData.totalHT)).up()

    // Total TVA (TaxTotalAmount avec attribut currencyID)
    totals
      .ele('ram:TaxTotalAmount')
      .att('currencyID', invoiceData.currencyCode)
      .txt(this.formatAmount(invoiceData.totalTVA))
      .up()

    // Total TTC (GrandTotalAmount)
    totals.ele('ram:GrandTotalAmount').txt(this.formatAmount(invoiceData.totalTTC)).up()

    // Montant à payer (DuePayableAmount) - généralement égal au TTC
    totals.ele('ram:DuePayableAmount').txt(this.formatAmount(invoiceData.totalTTC)).up()

    totals.up()
    settlement.up()
    transaction.up()

    // Génération du XML final
    return doc.end({ prettyPrint: true })
  }

  /**
   * Convertit une date YYYY-MM-DD en format CII YYYYMMDD
   */
  private formatDateToCII(date: string): string {
    // Supprimer les tirets pour obtenir YYYYMMDD
    return date.replace(/-/g, '')
  }

  /**
   * Formate un montant avec 2 décimales
   */
  private formatAmount(amount: string): string {
    const num = Number.parseFloat(amount)
    if (Number.isNaN(num)) {
      return '0.00'
    }
    return num.toFixed(2)
  }
}
