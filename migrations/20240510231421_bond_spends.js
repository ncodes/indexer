/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('bond_spends', (table) => {
      table.integer('sideAllocPct');
      table.integer('allocPct');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('bond_spends', (table) => {
      table.dropColumn('sideAllocPct');
      table.dropColumn('allocPct');
    }),
  ]);
};
