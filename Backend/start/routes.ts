/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import { rateLimitConfig } from '#middleware/rate_limit_middleware'

const InvoicesController = () => import('#controllers/invoices_controller')
const BatchInvoicesController = () => import('#controllers/batch_invoices_controller')
const AuthController = () => import('#controllers/auth_controller')
const PaymentsController = () => import('#controllers/payments_controller')

router.get('/', async () => {
  return {
    name: 'Metron API',
    version: '1.0.0',
    status: 'healthy',
  }
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
// Routes protégées par clé API - Facture unitaire
// ============================================
router
  .group(() => {
    router.post('/invoices/facturx', [InvoicesController, 'generate'])
  })
  .prefix('/api')
  .use([
    middleware.apiKeyAuth(),
    middleware.rateLimit(rateLimitConfig.single()),
    middleware.quotaCheck({ type: 'single' }),
  ])

// ============================================
// Routes protégées par clé API - Batch (Plan Pro)
// ============================================
router
  .group(() => {
    // Soumettre un nouveau batch
    router.post('/invoices/batch', [BatchInvoicesController, 'submit'])
      .use([
        middleware.rateLimit(rateLimitConfig.batchSubmit()),
        middleware.quotaCheck({ type: 'batch' }),
      ])

    // Lister les batchs de l'utilisateur
    router.get('/invoices/batch', [BatchInvoicesController, 'list'])
      .use(middleware.rateLimit(rateLimitConfig.batchStatus()))

    // Obtenir le statut d'un batch
    router.get('/invoices/batch/:jobId', [BatchInvoicesController, 'status'])
      .use(middleware.rateLimit(rateLimitConfig.batchStatus()))

    // Télécharger le résultat
    router.get('/invoices/batch/:jobId/download', [BatchInvoicesController, 'download'])
      .use(middleware.rateLimit(rateLimitConfig.download()))

    // Annuler un batch
    router.delete('/invoices/batch/:jobId', [BatchInvoicesController, 'cancel'])
      .use(middleware.rateLimit(rateLimitConfig.batchSubmit()))
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
    // Gestion de la clé API (une seule par utilisateur)
    router.get('/api-keys/me', [AuthController, 'getMyApiKey'])
    router.post('/api-keys/generate', [AuthController, 'generateApiKey'])
    router.delete('/api-keys/revoke', [AuthController, 'revokeApiKey'])
  })
  .prefix('/api/auth')
  .use(middleware.auth())

// ============================================
// Routes de paiement Stripe
// ============================================

// Webhook Stripe (sans authentification, vérifié par signature)
router.post('/api/payments/webhook', [PaymentsController, 'webhook'])

// Routes protégées par token utilisateur
router
  .group(() => {
    router.post('/checkout', [PaymentsController, 'createCheckout'])
    router.post('/portal', [PaymentsController, 'createPortal'])
    router.get('/subscription', [PaymentsController, 'getSubscription'])
  })
  .prefix('/api/payments')
  .use(middleware.auth())
