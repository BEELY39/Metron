import vine from '@vinejs/vine'

/**
 * Validator pour les données de facture Factur-X
 * Valide toutes les données envoyées via l'API
 */

// Schéma pour l'adresse
const addressSchema = vine.object({
  street: vine.string().optional(),
  zipCode: vine.string().optional(),
  city: vine.string().optional(),
  countryCode: vine
    .string()
    .fixedLength(2)
    .toUpperCase(), // Code ISO 3166-1 alpha-2 (FR, DE, ES, etc.)
})

// Schéma pour une ligne de facture (optionnel, pour profil BASIC)
const invoiceLineSchema = vine.object({
  description: vine.string(),
  quantity: vine.string(),
  unitPrice: vine.string(),
  vatRate: vine.string(),
  totalHT: vine.string(),
})

// Schéma principal pour la facture
export const invoiceValidator = vine.compile(
  vine.object({
    // Informations facture
    invoiceNumber: vine.string().minLength(1),
    invoiceDate: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/), // Format YYYY-MM-DD
    invoiceTypeCode: vine.enum(['380', '381']).optional(), // 380=Facture, 381=Avoir

    // Vendeur (obligatoire)
    sellerName: vine.string().minLength(1),
    sellerSiret: vine
      .string()
      .fixedLength(14)
      .regex(/^\d{14}$/), // SIRET = 14 chiffres
    sellerVatNumber: vine
      .string()
      .regex(/^[A-Z]{2}[A-Z0-9]{2,13}$/)
      .optional(), // Format TVA intracommunautaire
    sellerAddress: addressSchema,

    // Acheteur (obligatoire)
    buyerName: vine.string().minLength(1),
    buyerSiret: vine
      .string()
      .fixedLength(14)
      .regex(/^\d{14}$/)
      .optional(),
    buyerVatNumber: vine
      .string()
      .regex(/^[A-Z]{2}[A-Z0-9]{2,13}$/)
      .optional(),
    buyerAddress: addressSchema,

    // Montants (obligatoire)
    currencyCode: vine
      .string()
      .fixedLength(3)
      .toUpperCase(), // Code ISO 4217 (EUR, USD, etc.)
    totalHT: vine.string().regex(/^\d+(\.\d{1,2})?$/), // Format: 1000 ou 1000.00
    totalTVA: vine.string().regex(/^\d+(\.\d{1,2})?$/),
    totalTTC: vine.string().regex(/^\d+(\.\d{1,2})?$/),

    // Optionnel
    lines: vine.array(invoiceLineSchema).optional(),
    paymentTerms: vine.string().optional(),
    paymentDueDate: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    purchaseOrderReference: vine.string().optional(),
  })
)

// Type inféré depuis le validator (utile pour le typage)
export type InvoiceValidatorData = Awaited<ReturnType<typeof invoiceValidator.validate>>
