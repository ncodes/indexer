/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.alterTable('chain_events', (table) => {
      table.dropUnique(['network', 'signature', 'blockNumber', 'txIndex', 'logIndex']);
      table.unique(['network', 'signature', 'blockNumber', 'txIndex', 'logIndex', 'removed']);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.alterTable('chain_events', (table) => {
      table.dropUnique(['network', 'signature', 'blockNumber', 'txIndex', 'logIndex', 'removed']);
      table.unique(['network', 'signature', 'blockNumber', 'txIndex', 'logIndex']);
    }),
  ]);
};
