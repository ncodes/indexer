exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('mine_tasks', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('type');
      table.string('network');
      table.string('marketAddress');
      table.integer('orderId');
      table.integer('disputeId');
      table.boolean('completed').defaultTo(false);
      table.string('token');
      table.timestamp('mineAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('mine_tasks')]);
};
