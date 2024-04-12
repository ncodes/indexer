/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.string('discordToken');
      table.timestamp('discordLinkedAt');
      table.string('twitterUsername');
      table.string('twitterToken');
      table.boolean('isEarlyDiscordMember').defaultTo(false);
      table.timestamp('twitterLinkedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('users', (table) => {
      table.dropColumn('twitterUsername');
      table.dropColumn('twitterToken');
      table.dropColumn('discordToken');
      table.dropColumn('twitterLinkedAt');
      table.dropColumn('discordLinkedAt');
      table.dropColumn('isEarlyDiscordMember');
    }),
  ]);
};
