/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.boolean('presale').defaultTo(false);
      table.string('presaleCountry');
      table.string('ipCountry');
      table.boolean('presaleApproved').defaultTo(false);
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
      table.dropColumn('presale');
      table.dropColumn('presaleCountry');
      table.dropColumn('ipCountry');
      table.dropColumn('presaleApproved');
    }),
  ]);
};
