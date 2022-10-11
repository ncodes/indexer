exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('messages', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('type');
      table.string('network');
      table.string('marketId');
      table.string('swapId');
      table.integer('orderId');
      table.string('fromId');
      table.jsonb('messages').defaultTo([]);
      table.jsonb('recipientsId').defaultTo([]);
      table.jsonb('recipientsMsgPubKey').defaultTo([]);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('messages')]);
};
