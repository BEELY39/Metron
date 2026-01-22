/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { XmlGeneratorService } from '#services/xml_generator_service'
import { middleware } from './kernel.js'

const InvoicesController = () => import('#controllers/invoices_controller')
const AuthController = () => import('#controllers/auth_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router.get('/generate-xml', async () => {
  const xmlGeneratorService = new XmlGeneratorService()
  const xml = await xmlGeneratorService.generateXml({
    invoiceNumber: 'F-2024-001',
    invoiceDate: '2024-01-15',
    sellerName: 'Ma Société SARL',
    sellerSiret: '12345678901234',
    sellerVatNumber: 'FR12345678901',
    sellerAddress: {
      street: '10 Rue de la Paix',
      zipCode: '75001',
      city: 'Paris',
      countryCode: 'FR',
    },
    buyerName: 'Client Entreprise SA',
    buyerSiret: '98765432109876',
    buyerAddress: {
      street: '25 Avenue des Champs',
      zipCode: '69001',
      city: 'Lyon',
      countryCode: 'FR',
    },
    currencyCode: 'EUR',
    totalHT: '1000.00',
    totalTVA: '200.00',
    totalTTC: '1200.00',
  })
  return xml
})

// ============================================
// Routes publiques (pas d'authentification)
// ============================================
router
  .group(() => {
    router.post('/register', [AuthController, 'register'])
    router.post('/login', [AuthController, 'login'])
  })
  .prefix('/api/auth')

// ============================================
// Routes protégées par clé API
// ============================================
router
  .group(() => {
    // Génération de PDF Factur-X (requiert une clé API valide)
    router.post('/invoices/facturx', [InvoicesController, 'generate'])
  })
  .prefix('/api')
  .use(middleware.apiKeyAuth())

// ============================================
// Routes protégées par token utilisateur (frontend)
// ============================================
router
  .group(() => {
    // Profil utilisateur
    router.get('/me', [AuthController, 'me'])
    router.post('/logout', [AuthController, 'logout'])
    // Gestion des clés API
    router.post('/api-keys', [AuthController, 'createApiKey'])
    router.get('/api-keys', [AuthController, 'listApiKeys'])
    router.delete('/api-keys/:id', [AuthController, 'revokeApiKey'])
  })
  .prefix('/api/auth')
  .use(middleware.auth())
