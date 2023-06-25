exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('notifications', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('userId');
      table.string('type').notNullable();
      table.text('title');
      table.text('body');
      table.boolean('read').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('notifications')]);
};
