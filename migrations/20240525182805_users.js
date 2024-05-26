/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.bigint('telegramUserId');
      table.string('telegramUsername');
      table.timestamp('telegramLastAuthAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.dropColumn('telegramUserId');
      table.dropColumn('telegramUsername');
      table.dropColumn('telegramLastAuthAt');
    }),
  ]);
};
