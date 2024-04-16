/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('markets', (table) => {
      table.dropColumn('evidenceDur');
      table.dropColumn('predictDur');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('markets', (table) => {
      table.integer('evidenceDur');
      table.integer('predictDur');
    }),
  ]);
};
