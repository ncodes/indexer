/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('swaps', (table) => {
      table.index(
        ['network', 'cancelled', 'instant', 'provider', 'taker'],
        'idx_network_cancelled_instant_provider_taker',
      );
      table.index(['network', 'provider', 'cancelled', 'instant'], 'idx_network_provider_cancelled_instant');
      table.index(['network', 'taker', 'cancelled', 'instant'], 'idx_network_taker_cancelled_instant');
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
      table.dropIndex(
        ['network', 'cancelled', 'instant', 'provider', 'taker'],
        'idx_network_cancelled_instant_provider_taker',
      );
      table.dropIndex(['network', 'provider', 'cancelled', 'instant'], 'idx_network_provider_cancelled_instant');
      table.dropIndex(['network', 'taker', 'cancelled', 'instant'], 'idx_network_taker_cancelled_instant');
    }),
  ]);
};
