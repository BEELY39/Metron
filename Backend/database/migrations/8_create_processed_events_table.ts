import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Table pour stocker les événements Stripe déjà traités.
 * Garantit l'idempotence des webhooks.
 */
export default class extends BaseSchema {
  protected tableName = 'processed_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('stripe_event_id', 255).notNullable().unique()
      table.string('event_type', 100).notNullable()
      table.timestamp('created_at')

      // Index pour les requêtes de lookup rapides
      table.index(['stripe_event_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
