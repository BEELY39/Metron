import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'api_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE') // Si l'utilisateur est supprimé, ses clés aussi
      table.string('name').notNullable() // Nom descriptif
      table.string('key').notNullable() // Clé hashée
      table.string('key_prefix', 12).notNullable() // Préfixe pour identification
      table.boolean('is_active').defaultTo(true)
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Index pour recherche rapide par préfixe
      table.index(['key_prefix'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
