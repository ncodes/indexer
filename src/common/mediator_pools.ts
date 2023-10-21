import { SupportedNetworks, powOf } from '../network/common';

type MediatorPool = {
  name: string;
  description: string;
  id: number;
  reqBond: string;
  draftReward: string;
  winReward: string;
  noVoteSlashBP: number;
  loseVoteSlashBP: number;
  numDraftees: number;
};

const KnownMediatorPools: { [network: string]: MediatorPool[] } = {
  [SupportedNetworks.Localhost]: [
    {
      name: 'General',
      description: 'For mediators specializing in global crypto to cash swaps.',
      id: 0,
      reqBond: powOf(10, 18).toString(),
      draftReward: powOf(10, 18).toString(),
      winReward: powOf(10, 18).toString(),
      noVoteSlashBP: 1000,
      loseVoteSlashBP: 1000,
      numDraftees: 3,
    },
  ],
  [SupportedNetworks.Ethereum]: [
    {
      name: 'General',
      description: 'For mediators specializing in global crypto to cash swaps.',
      id: 0,
      reqBond: powOf(10, 18).toString(),
      draftReward: powOf(10, 18).toString(),
      winReward: powOf(10, 18).toString(),
      noVoteSlashBP: 1000,
      loseVoteSlashBP: 1000,
      numDraftees: 3,
    },
  ],
};

export default KnownMediatorPools;
