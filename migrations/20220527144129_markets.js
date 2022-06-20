exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('markets', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('marketId');
      table.string('creator');
      table.string('base');
      table.string('baseAddress');
      table.boolean('isBaseLocal').defaultTo(false);
      table.string('quote');
      table.string('quoteAddress');
      table.boolean('isQuoteLocal').defaultTo(false);
      table.string('pair');
      table.string('network');
      table.integer('commission').defaultTo(0);
      table.string('amountSwapped').defaultTo(0);
      table.float('completionRate').defaultTo(0);
      table.timestamp('lastSuccessfulSwapAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index('marketId');
      table.unique(['network', 'marketId']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('markets')]);
};
