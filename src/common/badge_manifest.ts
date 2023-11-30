import { ChainNames } from '@jointlabs/chains-info';

type BadgeManifest = {
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
export const BadgeManifest: BadgeManifests = {
  localhost: {
    kyc: {
      name: 'KYC',
      issuer: 'Joint Labs',
      issuerAddress: '0x0B9Fc80B571e99C4ea796Eb34E75df59470826F3',
      logoUrl: 'https://storage.googleapis.com/joint-images/kyc-badge-icon.svg',
      shortDescription: 'Claim a KYC badge',
      longDescriptions: [
        'Complete the KYC process to claim a <span class="badge-chinese-green">kyc</span> badge that will grant you access to markets that require KYC.',
        'See our [privacy policy](http://joint.exchange/legal/privacy-policy) to learn how we handle your data.',
      ],
      claimPageUrl: 'http://localhost:3002/claim/kyc',
    },
  },
};
