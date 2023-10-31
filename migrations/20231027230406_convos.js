exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('convos', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.integer('orderId');
      table.integer('offerId');
      table.string('address');
      table.string('topic');
      table.boolean('muted').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('convos')]);
};
