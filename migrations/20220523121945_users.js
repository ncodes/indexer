exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('users', (table) => {
      table.increments('sn', { primaryKey: false });
      table.string('id').primary();
      table.string('email');
      table.string('address');
      table.string('locale');
      table.string('timezone');
      table.string('deviceTokenEmail');
      table.string('role');
      table.string('otpSecret');
      table.string('emailUnverified');
      table.string('refCode').unique();
      table.string('referrer');
      table.boolean('messagingEnabled').defaultTo(false);
      table.string('ipCountry');
      table.string('country');
      table.string('defaultPaymentMethodId');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
      table.timestamp('deletedAt');

      table.index(['address'], 'idx_address');
      table.index(['address'], 'idx_email');
      table.index(['address', 'deletedAt'], 'idx_address_deleted_at');
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([knex.schema.dropTable('users')]);
};
