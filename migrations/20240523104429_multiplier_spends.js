/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('multiplier_spends', (table) => {
      table.index(['userId'], 'idx_multi_user_id');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('multiplier_spends', (table) => {
      table.dropIndex(['userId'], 'idx_multi_user_id');
    }),
  ]);
};
