/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('payment_methods', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('network');
      table.string('userId');
      table.string('orgId');
      table.integer('type');
      table.string('name');
      table.string('accountId');
      table.string('bankAccountNumber');
      table.string('bankAccountName');
      table.string('routingNumber');
      table.string('swiftCode');
      table.text('additionalInfo');
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
  return Promise.all([knex.schema.dropTable('payment_methods')]);
};
