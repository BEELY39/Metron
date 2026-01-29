import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Plan: free, pro, enterprise
      table.enum('plan', ['free', 'pro', 'enterprise']).defaultTo('free').notNullable()

      // Compteur d'utilisation pour le mois en cours
      table.integer('invoices_used_this_month').defaultTo(0).notNullable()

      // Crédit prépayé en centimes (pour facturation unitaire)
      table.integer('credit_balance').defaultTo(0).notNullable()

      // Date de fin d'abonnement (null = pas d'abonnement actif)
      table.timestamp('subscription_ends_at', { useTz: true }).nullable()

      // Dernier reset du compteur mensuel
      table.timestamp('usage_reset_at', { useTz: true }).nullable()

      // ID Stripe customer (pour les paiements)
      table.string('stripe_customer_id').nullable()

      // ID PayPal customer
      table.string('paypal_customer_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('plan')
      table.dropColumn('invoices_used_this_month')
      table.dropColumn('credit_balance')
      table.dropColumn('subscription_ends_at')
      table.dropColumn('usage_reset_at')
      table.dropColumn('stripe_customer_id')
      table.dropColumn('paypal_customer_id')
    })
  }
}
