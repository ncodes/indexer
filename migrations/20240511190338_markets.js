/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('markets', (table) => {
      table.string('baseLogo');
      table.string('quoteLogo');
      table.decimal('basePriceUsd', null);
      table.decimal('quotePriceUsd', null);
      table.timestamp('lastMetaUpdatedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('markets', (table) => {
      table.dropColumn('baseLogo');
      table.dropColumn('quoteLogo');
      table.dropColumn('basePriceUsd');
      table.dropColumn('quotePriceUsd');
      table.dropColumn('lastMetaUpdatedAt');
    }),
  ]);
};
