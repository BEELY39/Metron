import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoice_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Référence utilisateur et clé API
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('api_key_id').unsigned().references('id').inTable('api_keys').onDelete('SET NULL').nullable()

      // Référence au batch job (null si facture unitaire)
      table.integer('batch_job_id').unsigned().nullable()

      // Type: single ou batch
      table.enum('type', ['single', 'batch']).notNullable()

      // Nombre de factures traitées
      table.integer('invoice_count').defaultTo(1).notNullable()

      // Coût en centimes (pour facturation)
      table.integer('cost_cents').defaultTo(0).notNullable()

      // Statut: pending, processing, completed, failed
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending')

      // Message d'erreur si échec
      table.text('error_message').nullable()

      // Métadonnées (JSON) - infos supplémentaires
      table.json('metadata').nullable()

      // IP de la requête (sécurité)
      table.string('ip_address', 45).nullable()

      // User-Agent (sécurité)
      table.string('user_agent', 500).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      // Index pour les requêtes fréquentes
      table.index(['user_id', 'created_at'])
      table.index(['api_key_id', 'created_at'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
