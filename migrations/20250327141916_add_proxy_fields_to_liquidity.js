/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.table('liquidities', function (table) {
        table.string('proxy').nullable();
        table.string('proxyProvider').nullable();
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.table('liquidities', function (table) {
        table.dropColumn('proxy');
        table.dropColumn('proxyProvider');
      });
};
