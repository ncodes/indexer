// exports.up = function (knex) {
//   return Promise.all([
//     knex.schema.createTable('users', (table) => {
//       table.increments('sn', { primaryKey: false });
//       table.string('id').primary();
//       table.string('email');
//       table.string('username');
//       table.string('password');
//       table.string('firstName');
//       table.string('lastName');
//       table.string('phoneNumber');
//       table.string('role');
//       table.string('tfaSecretEmail');
//       table.boolean('tfaEnabledEmail').notNullable().defaultTo(false);
//       table.boolean('tfaEnabledPhone').notNullable().defaultTo(false);
//       table.string('tfaAuthAppSecret');
//       table.string('tfaAuthAppTempSecret');
//       table.boolean('tfaEnabledAuthApp').notNullable().defaultTo(false);
//       table.boolean('confirmed').notNullable().defaultTo(false);
//       table.string('kycApplicantId');
//       table.string('kycStatus');
//       table.string('kycProposedLevel');
//       table.string('kycLevel');
//       table.string('kycComment');
//       table.string('pushToken');
//       table.timestamp('createdAt');
//       table.timestamp('updatedAt');
//       table.timestamp('deletedAt');

//       table.index(['email'], 'idx_email');
//       table.index(['phoneNumber'], 'idx_phone_number');
//     }),
//   ]);
// };

// exports.down = function (knex) {
//   return Promise.all([knex.schema.dropTable('users')]);
// };
