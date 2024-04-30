exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('bond_spends', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('battleId').notNullable();
      table.string('userId').notNullable();
      table.decimal('amount', null).defaultTo(0);
      table.string('side').notNullable();
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('bond_spends')]);
};
