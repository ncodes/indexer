exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('events', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('signature');
      table.integer('blockNumber');
      table.integer('txIndex');
      table.integer('logIndex');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.unique([
        'network',
        'signature',
        'blockNumber',
        'txIndex',
        'logIndex',
      ]);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('events')]);
};
