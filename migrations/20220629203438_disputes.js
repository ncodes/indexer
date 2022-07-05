exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('disputes', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('marketId');
      table.integer('orderId');
      table.integer('disputeId');
      table.string('creator');
      table.string('defendant');
      table.string('deposit');
      table.integer('numMediators').defaultTo(0);
      table.integer('numMediatorsDrafted').defaultTo(0);
      table.boolean('wantRelease').defaultTo(false);
      table.boolean('executed').defaultTo(false);
      table.boolean('released').defaultTo(false);
      table.boolean('appeal').defaultTo(false);
      table.boolean('abandoned').defaultTo(false);
      table.timestamp('evidenceEndAt');
      table.timestamp('commitEndAt');
      table.timestamp('revealEndAt');
      table.timestamp('predictEndAt');
      table.timestamp('appealEndAt');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('disputes')]);
};
