/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.renameTable('merkle_tree', 'token_claims'),
    knex.schema.table('token_claims', (table) => {
      table.renameColumn('proof', 'signature');
      table.integer('nonce').defaultTo(0);
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.renameTable('token_claims', 'merkle_tree'),
    knex.schema.table('merkle_tree', (table) => {
      table.renameColumn('signature', 'proof');
      table.dropColumn('nonce');
    }),
  ]);
};
