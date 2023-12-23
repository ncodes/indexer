export const MarketPoints = {
  'market:created': 10,

  // Set swap point per unit in a market
  'swap:0x12345': 1000,

  // Set swap points per unit for all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'swap:instant': 100,

  // Set swap point per unit for all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'swap:interactive': 100,

  // Set the maximum swap point per level for a market.
  // If a swap amount is larger than this amount, the swap will be divided by
  // this level amount and the points will be awarded for each level.
  'swap:level:0x12345': 1000,

  'swap:cancelled': 10,
  'swap:paid': 10,

  // Set the point per unit of liquidity added to a specific market
  'liq:0x12345': 1000,

  // Set the point per unit of liquidity added to all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'liq:instant': 100,

  // Set the point per unit of liquidity added to all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'liq:interactive': 100,

  'liq:price_updated': 10,
  'liq:paused': 10,

  'offer:created': 10,
  'offer:updated': 10,
  'offer:accepted': 10,
  'offer:unaccepted': 10,
  'offer:cancelled': 10,
  'offer:executed': 10,

  'dispute:created': 10,
  'dispute:committed': 10,
  'dispute:revealed': 10,
  'dispute:executed': 10,

  'ticket:purchased': 10,
  'ticket:cancelled': 10,
  'ticket:drained': 10,
  'ticket:joined': 10,
  'ticket:drafted': 10,
  'ticket:drafter': 10,
  'ticket:undrafted': 10,
  'ticket:undrafter': 10,
  'ticket:slashed': 10,
};
