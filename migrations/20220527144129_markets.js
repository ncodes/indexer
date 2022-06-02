exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('markets', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('mid');
      table.string('creator');
      table.string('base');
      table.string('baseAddress');
      table.boolean('isBaseLocal').defaultTo(false);
      table.string('quote');
      table.string('quoteAddress');
      table.boolean('isQuoteLocal').defaultTo(false);
      table.string('pair');
      table.string('network');
      table.integer('blockNumber');
      table.string('blockHash');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.unique(['network', 'mid']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('markets')]);
};
