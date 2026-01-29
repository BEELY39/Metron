import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'batch_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // UUID public pour le client (ne pas exposer l'ID auto-incrémenté)
      table.uuid('public_id').notNullable().unique()

      // Référence utilisateur et clé API
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('api_key_id').unsigned().references('id').inTable('api_keys').onDelete('SET NULL').nullable()

      // Statut du job
      table.enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled']).defaultTo('pending')

      // Nombre total de factures dans le batch
      table.integer('total_invoices').defaultTo(0).notNullable()

      // Nombre de factures traitées
      table.integer('processed_invoices').defaultTo(0).notNullable()

      // Nombre de factures en erreur
      table.integer('failed_invoices').defaultTo(0).notNullable()

      // Progression en pourcentage (0-100)
      table.integer('progress').defaultTo(0).notNullable()

      // Chemin du fichier ZIP d'entrée (temporaire)
      table.string('input_zip_path', 500).nullable()

      // Chemin du fichier CSV de métadonnées (temporaire)
      table.string('metadata_csv_path', 500).nullable()

      // Chemin du fichier ZIP de sortie (résultat)
      table.string('output_zip_path', 500).nullable()

      // Taille du fichier de sortie en octets
      table.bigInteger('output_size_bytes').nullable()

      // URL de téléchargement (expirable)
      table.string('download_url', 1000).nullable()

      // Date d'expiration du téléchargement
      table.timestamp('download_expires_at', { useTz: true }).nullable()

      // Coût total en centimes
      table.integer('total_cost_cents').defaultTo(0).notNullable()

      // Message d'erreur global si échec
      table.text('error_message').nullable()

      // Erreurs détaillées par fichier (JSON)
      table.json('errors_detail').nullable()

      // Métadonnées supplémentaires
      table.json('metadata').nullable()

      // IP et User-Agent (sécurité)
      table.string('ip_address', 45).nullable()
      table.string('user_agent', 500).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      // Index
      table.index(['user_id', 'status'])
      table.index(['public_id'])
      table.index(['status', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
