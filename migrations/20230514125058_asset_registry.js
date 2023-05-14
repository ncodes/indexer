exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('asset_registry', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('address');
      table.string('curRate');
      table.integer('feeBp');
      table.string('feeFixed');
      table.string('amountPerRewardPoint');
      table.boolean('verified').defaultTo(false);
      table.boolean('stable').defaultTo(false);
      table.boolean('sharable').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index(['network', 'address']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('asset_registry')]);
};
