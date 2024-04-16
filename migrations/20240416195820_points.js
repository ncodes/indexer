/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('points', (table) => {
      table.boolean('redenominated').defaultTo(false);
      table.decimal('oldPoint', null);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('points', (table) => {
      table.dropColumn('redenominated');
      table.dropColumn('oldPoint');
    }),
  ]);
};
