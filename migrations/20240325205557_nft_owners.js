exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('nft_owners', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('address');
      table.integer('tokenId');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('nft_owners')]);
};
