export enum TapSpendType {
  HyperFire = 'hyper-fire',
  AntiOverheat = 'anti-overheat',
  HyperCool = 'hyper-cool',
  RapidFire = 'rapid-fire',
  InstantCool = 'instant-cool',
}

export const MaxRapidFirePerWindow = 3;
export const RapidFireWindow = 12 * 60 * 60; // 12 hours
export const RapidFireActiveTime = 20;

export const MaxInstantCoolPerWindow = 3;
export const InstantCoolWindow = 12 * 60 * 60; // 12 hours

export const MultiplierApplyWindow = 12 * 60 * 60; // 12 hours
export const MultiplierApplyMaxPerWindow = 1;
export const MultiplierCost = '100';
export const Multiplier = 10;

export const RefereeBonus = 5000;
export const FollowQuestBonus = 200000;

export const RankInfo = {
  Cadet: {
    taps: 1,
    reward: 1000,
  },
  Ensign: {
    taps: 10000,
    reward: 5000,
  },
  'Lieutenant Jnr': {
    taps: 30000,
    reward: 20000,
  },
  Lieutenant: {
    taps: 100000,
    reward: 50000,
  },
  Commander: {
    taps: 250000,
    reward: 100000,
  },
  Captain: {
    taps: 1000000,
    reward: 200000,
  },
  Commodore: {
    taps: 3000000,
    reward: 350000,
  },
  'Rear Admiral': {
    taps: 5000000,
    reward: 500000,
  },
  'Vice Admiral': {
    taps: 10000000,
    reward: 750000,
  },
  Admiral: {
    taps: 100000000,
    reward: 1000000,
  },
};

export const ReferralInfo = [
  { count: 1, reward: 5000 },
  { count: 3, reward: 30000 },
  { count: 10, reward: 200000 },
  { count: 25, reward: 250000 },
  { count: 50, reward: 300000 },
  { count: 100, reward: 500000 },
  { count: 500, reward: 2000000 },
  { count: 1000, reward: 2500000 },
  { count: 10000, reward: 10000000 },
  { count: 100000, reward: 100000000 },
];

export const TapSpendLevelCost: Record<TapSpendType, Record<number, { cost: string; increment: number }>> = {
  [TapSpendType.HyperFire]: {
    [1]: { cost: '0', increment: 1 },
    [2]: { cost: '500', increment: 1 },
    [3]: { cost: '1000', increment: 2 },
    [4]: { cost: '2000', increment: 3 },
    [5]: { cost: '4000', increment: 4 },
    [6]: { cost: '8000', increment: 5 },
    [7]: { cost: '16000', increment: 6 },
    [8]: { cost: '32000', increment: 7 },
    [9]: { cost: '64000', increment: 8 },
    [10]: { cost: '128000', increment: 9 },
    [11]: { cost: '256000', increment: 10 },
    [12]: { cost: '512000', increment: 11 },
  },
  [TapSpendType.AntiOverheat]: {
    [1]: { cost: '0', increment: 500 },
    [2]: { cost: '200', increment: 500 },
    [3]: { cost: '500', increment: 1000 },
    [4]: { cost: '1000', increment: 1500 },
    [5]: { cost: '2000', increment: 2000 },
    [6]: { cost: '4000', increment: 2500 },
    [7]: { cost: '8000', increment: 3000 },
    [8]: { cost: '16000', increment: 3500 },
    [9]: { cost: '32000', increment: 4000 },
    [10]: { cost: '64000', increment: 4500 },
    [11]: { cost: '128000', increment: 5000 },
    [12]: { cost: '256000', increment: 5500 },
  },
  [TapSpendType.HyperCool]: {
    [1]: { cost: '0', increment: 1 },
    [2]: { cost: '2000', increment: 1 },
    [3]: { cost: '10000', increment: 2 },
    [4]: { cost: '50000', increment: 3 },
    [5]: { cost: '100000', increment: 4 },
    [6]: { cost: '200000', increment: 5 },
    [7]: { cost: '400000', increment: 6 },
    [8]: { cost: '800000', increment: 7 },
    [9]: { cost: '1600000', increment: 8 },
    [10]: { cost: '3200000', increment: 9 },
    [11]: { cost: '6400000', increment: 10 },
    [12]: { cost: '12800000', increment: 11 },
  },
  [TapSpendType.RapidFire]: {},
  [TapSpendType.InstantCool]: {},
};
