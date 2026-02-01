# Metron

Plateforme de facturation électronique Factur-X conforme aux normes européennes.

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Angular 19 |
| Backend | AdonisJS 6 |
| Base de données | PostgreSQL |
| Paiements | Stripe |
| Conteneurisation | Docker |

## Installation

### Prérequis

- Node.js 20+
- Docker & Docker Compose
- Compte Stripe (mode test)

### Backend

```bash
cd Backend
npm install
cp .env.example .env  # Configurer les variables
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm start
```

### Base de données

```bash
docker-compose up -d postgres
cd Backend
node ace migration:run
```

## Configuration

### Variables d'environnement Backend (.env)

```env
# App
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=your_app_key

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=root
DB_PASSWORD=root
DB_DATABASE=app

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
FRONTEND_URL=http://localhost:4200
```

## Architecture

```
Metron/
├── Backend/
│   ├── app/
│   │   ├── controllers/
│   │   ├── models/
│   │   └── services/
│   ├── database/migrations/
│   └── start/
└── frontend/
    └── src/app/
        ├── pages/
        └── services/
```

## Fonctionnalités

### Facturation Factur-X
- Upload PDF et conversion en Factur-X
- API REST pour intégration
- Traitement par lot (plan Pro)

### Plans

| Plan | Prix | Factures/mois |
|------|------|---------------|
| Gratuit | 0€ | 1 |
| Pro | 10€ | 10 000 |

### Sécurité Paiements (5 lois bancaires)

1. **Idempotence** - Table `processed_events` pour éviter les doublons
2. **Atomicité** - Transactions DB pour chaque webhook
3. **Précision** - Montants en centimes (integers)
4. **Webhook Gravity** - Vérification signature Stripe côté serveur
5. **Exclusion Mutuelle** - Verrous `FOR UPDATE` sur les lignes utilisateur

## API

### Générer une facture Factur-X

```bash
curl -X POST https://api.metron.fr/api/invoices/facturx \
  -H "X-API-Key: votre_cle_api" \
  -F "pdf=@facture.pdf" \
  -F "invoiceNumber=FAC-2026-001" \
  -F "sellerName=Ma Société" \
  -F "sellerSiret=12345678901234" \
  -F "totalHT=1000.00" \
  -F "totalTTC=1200.00" \
  -o facture-facturx.pdf
```

## Tests Stripe en local

```bash
cd Backend/tests
./stripe.exe listen --forward-to localhost:3333/api/payments/webhook
```

Carte de test : `4242 4242 4242 4242`

## Licence

MIT
