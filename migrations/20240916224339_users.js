/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.string('country');
      table.string('defaultPaymentMethodId');
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
      table.dropColumn('country');
      table.dropColumn('defaultPaymentMethodId');
    }),
  ]);
};
