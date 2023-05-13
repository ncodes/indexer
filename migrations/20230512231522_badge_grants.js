exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('badge_grants', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('badge');
      table.string('path');
      table.string('grantee');
      table.jsonb('metadata');
      table.timestamp('expireAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index('grantee');
      table.index(['network', 'grantee']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('badge_grants')]);
};
