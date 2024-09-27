/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('swaps', (table) => {
      table.string('takerPaymentMethodId');
      table.string('providerPaymentMethodId');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('swaps', (table) => {
      table.dropColumn('takerPaymentMethodId');
      table.dropColumn('providerPaymentMethodId');
    }),
  ]);
};
