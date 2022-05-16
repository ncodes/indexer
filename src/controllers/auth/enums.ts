/**
 * AuthFactor represents supported auth factors.
 */
export enum AuthFactors {
  Email = 'email',
  Phone = 'phone',
  AuthApp = 'auth_app',
}

/**
 * Get the supported auth factors
 * @returns
 */
export function getAuthFactors(): string[] {
  const r = [];
  Object.keys(AuthFactors).forEach((k) => {
    r.push(AuthFactors[k]);
  });
  return r;
}
