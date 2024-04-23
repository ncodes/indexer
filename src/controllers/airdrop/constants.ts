export enum TapSpendType {
  HyperFire = 'hyper-fire',
  AntiOverheat = 'anti-overheat',
  HyperCool = 'hyper-cool',
  RapidFire = 'rapid-fire',
  InstantCool = 'instant-cool',
}

export const MaxRapidFirePerPeriod = 3;
export const RapidFireWindow = 12 * 60 * 60; // 12 hours
export const RapidFireActiveTime = 20;

export const MaxInstantCoolPerPeriod = 3;
export const InstantCoolWindow = 12 * 60 * 60; // 12 hours

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
