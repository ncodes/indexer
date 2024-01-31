/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('notification_settings', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('userId');
      table.string('resource');
      table.boolean('disabled').defaultTo(false);
      table.boolean('disabledSwap').defaultTo(false);
      table.boolean('disabledLiq').defaultTo(false);
      table.boolean('disabledOffer');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('notification_settings')]);
};
