/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('tickets', (table) => {
      table.boolean('blocked').defaultTo(false);
      table.boolean('paused').defaultTo(false);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('tickets', (table) => {
      table.dropColumn('blocked');
      table.dropColumn('paused');
    }),
  ]);
};
