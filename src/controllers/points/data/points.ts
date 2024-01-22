export const MarketPoints = {
  'market:created': 10,

  // Set swap point per unit in a market
  'swap:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 3000,
  'swap:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 3000,
  'swap:0x0593D8cE5586b68423b31732713435F4f62f44BF': 3000,
  'swap:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 3000,

  // Set swap points per unit for all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'swap:instant': 0,

  // Set swap point per unit for all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'swap:interactive': 0,

  // Swap point levels
  'swap:level:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 10000,
  'swap:level:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 10000,
  'swap:level:0x0593D8cE5586b68423b31732713435F4f62f44BF': 10000,
  'swap:level:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 10000,

  'swap:cancelled': 100,
  'swap:paid': 100,

  // Set the point per unit of liquidity added to a specific market
  'liq:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 5000,
  'liq:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 5000,
  'liq:0x0593D8cE5586b68423b31732713435F4f62f44BF': 5000,
  'liq:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 5000,

  // Set the point per unit of liquidity added to all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'liq:instant': 0,

  // Set the point per unit of liquidity added to all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'liq:interactive': 0,

  // Liquidity point levels
  'liq:level:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 10000,
  'liq:level:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 10000,
  'liq:level:0x0593D8cE5586b68423b31732713435F4f62f44BF': 10000,
  'liq:level:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 10000,

  'liq:price_updated': 100,
  'liq:paused': 100,

  'offer:created': 200,
  'offer:updated': 100,
  'offer:accepted': 100,
  'offer:unaccepted': 100,
  'offer:cancelled': 100,
  'offer:executed': 200,

  'dispute:created': 100,
  'dispute:committed': 100,
  'dispute:revealed': 100,
  'dispute:executed': 100,

  'ticket:purchased': 1000,
  'ticket:cancelled': 0,
  'ticket:drained': 0,
  'ticket:joined': 200,
  'ticket:drafted': 500,
  'ticket:drafter': 1000,
  'ticket:undrafted': 0,
  'ticket:undrafter': 1000,
  'ticket:slashed': 0,
};
