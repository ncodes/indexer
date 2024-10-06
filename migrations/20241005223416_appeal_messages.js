/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('appeal_messages', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('appealId');
      table.string('orderId');
      table.string('creatorId');
      table.text('text');
      table.jsonb('files').defaultTo('[]');
      table.jsonb('fileUrls').defaultTo('[]');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');
    }),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('appeal_messages')]);
};
