exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('badges', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('issuer');
      table.string('coIssuer');
      table.string('badge');
      table.string('path');
      table.jsonb('metadata');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index('badge');
      table.index(['network', 'issuer', 'badge', 'path']);
      table.index(['network', 'badge', 'path']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('badges')]);
};
