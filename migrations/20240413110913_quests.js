exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('quests', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('questId');
      table.string('name');
      table.string('type');
      table.string('link');
      table.string('account');
      table.string('tag');
      table.double('engageBond').defaultsTo(0);
      table.double('verifyBond').defaultsTo(0);
      table.integer('maxVotes').defaultsTo(0);
      table.integer('verifyPoints').defaultsTo(0);
      table.integer('engagePoints').defaultsTo(0);
      table.boolean('pinned').defaultsTo(false);
      table.boolean('ended').defaultsTo(false);
      table.integer('count').defaultsTo(1);
      table.string('marketAddress');
      table.string('provider');
      table.integer('lid');
      table.integer('priority').defaultsTo(0);

      table.string('responderId');
      table.string('responderLink');
      table.integer('voteNo').defaultsTo(0);
      table.integer('voteYes').defaultsTo(0);
      table.boolean('finalized').defaultsTo(false);
      table.jsonb('voters').defaultsTo('[]');
      table.jsonb('votes').defaultsTo('{}');

      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('quests')]);
};
