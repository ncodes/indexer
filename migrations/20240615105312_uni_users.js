/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('uni_users', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('address');
      table.string('claimSignature');
      table.boolean('claimed').defaultTo(false);
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
  return Promise.all([knex.schema.dropTable('uni_users')]);
};
