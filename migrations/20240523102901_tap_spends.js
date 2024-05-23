/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('tap_spends', (table) => {
      table.index(['userId'], 'idx_user_id');
      table.index(['userId', 'type'], 'idx_user_id_type_id');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('tap_spends', (table) => {
      table.dropIndex(['userId'], 'idx_user_id');
      table.dropIndex(['userId', 'type'], 'idx_user_id_type_id');
    }),
  ]);
};
