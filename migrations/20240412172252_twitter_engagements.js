exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('twitter_engagements', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('twitterUserId');
      table.string('userId');
      table.string('address');
      table.string('tweetId');
      table.string('type');
      table.string('referencedTweetId');
      table.boolean('pointAwarded').defaultTo(false);
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('twitter_engagements')]);
};
