/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('taps', (table) => {
      table.string('battleId');
      table.string('battleSide');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('taps', (table) => {
      table.dropColumn('battleId');
      table.dropColumn('battleSide');
    }),
  ]);
};
