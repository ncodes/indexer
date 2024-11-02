/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.timestamp('tapToPointConvAt');
      table.string('addedMerkleEntryAt');
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
      table.dropColumn('tapToPointConvAt');
      table.dropColumn('addedMerkleEntryAt');
    }),
  ]);
};
