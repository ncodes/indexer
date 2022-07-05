exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('commits', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketId');
      table.integer('orderId');
      table.integer('disputeId');
      table.string('committer');
      table.string('hash');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('commits')]);
};
