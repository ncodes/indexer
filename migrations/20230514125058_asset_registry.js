exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('asset_registry', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('address');
      table.decimal('curRate', null);
      table.integer('feeBp');
      table.decimal('feeFixed', null);
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
