import { ChainNames } from '@jointlabs/chains-info';

export type BadgeManifest = {
  name: string;
  issuer: string;
  issuerAddress: string;
  logoUrl: string;
  shortDescription: string;
  longDescriptions: string[];
  claimPageUrl: string;
};

type BadgeManifests = { [key in ChainNames]?: { [badge: string]: BadgeManifest } };

// BadgeManifest contains information about a badge, the issuer and
// information required by the client to grant, manage and revoke the badge.
// The keys are regular expressions that match a badge being queried.
export const BadgeManifest: BadgeManifests = {
  localhost: {
    '^kyc(/[a-zA-Z]{3})?$': {
      name: '{badge}',
      issuer: 'Joint Labs',
      issuerAddress: '0x0B9Fc80B571e99C4ea796Eb34E75df59470826F3',
      logoUrl: 'https://storage.googleapis.com/joint-images/kyc-badge-icon.svg',
      shortDescription: 'Claim a KYC badge',
      longDescriptions: [
        'Complete the KYC process to claim a <span class="badge-chinese-green">{badge}</span> badge that will grant you access to markets that require KYC.',
        'See our [privacy policy](http://joint.exchange/legal/privacy-policy) to learn how we handle your data.',
      ],
      claimPageUrl: 'http://localhost:3002/claim/kyc',
    },
  },
};

/**
 * Parse badge local variables
 * @param badge The badge manifest
 * @param locals The local variables
 * @returns
 */
export function parseBadgeLocals(badge: BadgeManifest, locals: { [key: string]: string }): BadgeManifest {
  const badgeAsStr = JSON.stringify(badge);
  let str = badgeAsStr;
  for (const key in locals) {
    str = str.replace(new RegExp(`{${key}}`, 'g'), locals[key]);
  }
  return JSON.parse(str) as BadgeManifest;
}
