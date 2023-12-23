/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('points', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('name');
      table.string('network');
      table.string('address');
      table.decimal('point', null);
      table.string('action');
      table.string('referrer');
      table.string('referee');
      table.boolean('approved');
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
  return Promise.all([knex.schema.dropTable('points')]);
};
