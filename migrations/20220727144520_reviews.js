exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('reviews', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketAddress');
      table.string('swapId');
      table.string('reviewed');
      table.string('reviewerId');
      table.boolean('satisfied').defaultTo(false);
      table.text('comment');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('reviews')]);
};
