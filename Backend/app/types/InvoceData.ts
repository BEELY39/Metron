/**
 * Interface pour les données de facture Factur-X
 * Compatible avec le profil MINIMUM et BASIC
 */
export interface InvoiceData {
  // Informations de la facture
  invoiceNumber: string // Numéro de facture (ex: "F-2024-001")
  invoiceDate: string // Date au format YYYY-MM-DD (ex: "2024-01-15")
  invoiceTypeCode?: '380' | '381' // 380 = Facture, 381 = Avoir (défaut: 380)

  // Informations vendeur
  sellerName: string
  sellerSiret: string // SIRET 14 chiffres
  sellerVatNumber?: string // Numéro TVA intracommunautaire (ex: "FR12345678901")
  sellerAddress: Address

  // Informations acheteur
  buyerName: string
  buyerSiret?: string // SIRET (optionnel pour profil MINIMUM)
  buyerVatNumber?: string // Numéro TVA intracommunautaire
  buyerAddress: Address

  // Montants
  currencyCode: string // Code ISO 4217 (ex: "EUR")
  totalHT: string // Montant HT (ex: "1000.00")
  totalTVA: string // Montant TVA (ex: "200.00")
  totalTTC: string // Montant TTC (ex: "1200.00")

  // Optionnel - pour profil BASIC et supérieur
  lines?: InvoiceLine[]
  paymentTerms?: string // Conditions de paiement
  paymentDueDate?: string // Date d'échéance au format YYYY-MM-DD
  purchaseOrderReference?: string // Référence bon de commande
}

export interface Address {
  street?: string // Adresse (optionnel pour profil MINIMUM)
  zipCode?: string // Code postal (optionnel pour profil MINIMUM)
  city?: string // Ville (optionnel pour profil MINIMUM)
  countryCode: string // Code pays ISO 3166-1 alpha-2 (ex: "FR") - OBLIGATOIRE
}

export interface InvoiceLine {
  description: string // Description du produit/service
  quantity: string // Quantité
  unitPrice: string // Prix unitaire HT
  vatRate: string // Taux TVA (ex: "20.00" pour 20%)
  totalHT: string // Total ligne HT
}
