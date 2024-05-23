/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('taps', (table) => {
      table.index(['userId', 'deletedAt'], 'idx_user_id_deleted_at');
      table.index(['userId', 'bonus', 'deletedAt'], 'idx_user_id_bonus_deleted_at');
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
      table.dropIndex(['userId', 'deletedAt'], 'idx_user_id_deleted_at');
      table.dropIndex(['userId', 'bonus', 'deletedAt'], 'idx_user_id_bonus_deleted_at');
    }),
  ]);
};
