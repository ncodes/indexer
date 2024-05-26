/**
 * Roles are the supported user roles
 */
export enum Roles {
  Super = 'super',
  Admin = 'admin',
  App = 'app',
  User = 'user',
  TelegramLinkedUser = 'tg_user',
}

/**
 * getRoles returns the list of supported roles
 */
export function getRoles(): string[] {
  const keys = Object.keys(Roles);
  return keys.map((k) => Roles[k as any]);
}
