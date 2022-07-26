exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('message_read_statuses', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('msgId');
      table.string('userId');
      table.boolean('read').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('message_read_statuses')]);
};
