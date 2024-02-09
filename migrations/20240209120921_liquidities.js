/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('liquidities', (table) => {
      table.boolean('messagingEnabled').defaultTo(false);
      table.timestamp('messagingEnabledUpdatedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('liquidities', (table) => {
      table.dropColumn('messagingEnabled');
      table.dropColumn('messagingEnabledUpdatedAt');
    }),
  ]);
};
