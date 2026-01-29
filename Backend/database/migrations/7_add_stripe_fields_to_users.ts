import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Stripe subscription fields
      table.string('stripe_subscription_id').nullable()
      table.string('stripe_price_id').nullable()
      table.enum('subscription_status', [
        'active',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'past_due',
        'paused',
        'trialing',
        'unpaid'
      ]).nullable()
      table.timestamp('current_period_start', { useTz: true }).nullable()
      table.timestamp('current_period_end', { useTz: true }).nullable()
      table.boolean('cancel_at_period_end').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stripe_subscription_id')
      table.dropColumn('stripe_price_id')
      table.dropColumn('subscription_status')
      table.dropColumn('current_period_start')
      table.dropColumn('current_period_end')
      table.dropColumn('cancel_at_period_end')
    })
  }
}
