export const PointMap = {
  'market:created': 10,

  // Set swap point per unit in a market
  'swap:0x6716da1959059E384D0851C4f8518f5269d10Bad': 1000,
  'swap:0x9920e6F478a72691FC1d83bb3EC50d3892325D33': 1000,
  'swap:0x43C6176Fdd5bCc2dBb0aB42C685236f70D769aaD': 1000,
  'swap:0xC343A83CA282E0dc5D2a65923B7aF042797ffef3': 1000,
  'swap:0x0d57EcEF1376C956E7bA9e14e7f6a97e18Ce1030': 1000,
  'swap:0x061002B5e6F1a30cFc343b40Cfbc0067F0839b95': 1000,

  // Set swap points per unit for all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'swap:instant': 0,

  // Set swap point per unit for all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'swap:interactive': 0,

  // Swap point levels
  'swap:level:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 0,
  'swap:level:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 0,
  'swap:level:0x0593D8cE5586b68423b31732713435F4f62f44BF': 0,
  'swap:level:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 0,

  'swap:cancelled': 0,
  'swap:paid': 100,

  // Set the point per unit of liquidity added to a specific market
  'liq:0x6716da1959059E384D0851C4f8518f5269d10Bad': 1000,
  'liq:0x9920e6F478a72691FC1d83bb3EC50d3892325D33': 1000,
  'liq:0x43C6176Fdd5bCc2dBb0aB42C685236f70D769aaD': 1000,
  'liq:0xC343A83CA282E0dc5D2a65923B7aF042797ffef3': 1000,

  // Set the point per unit of liquidity added to all instant markets.
  // Set to zero to not incentivize unknown instant markets
  'liq:instant': 0,

  // Set the point per unit of liquidity added to all interactive markets.
  // Set to zero to not incentivize unknown interactive markets
  'liq:interactive': 0,

  // Liquidity point levels
  'liq:level:0x951e9E4389c5F135E3391022a61936fb2b426a7B': 0,
  'liq:level:0xc3839eAfD5Caf380456b4736C361bd3C61c743E5': 0,
  'liq:level:0x0593D8cE5586b68423b31732713435F4f62f44BF': 0,
  'liq:level:0x09aF70C8d985Db633562b7d6A24cAdFdDa265B73': 0,

  'liq:price_updated': 0,
  'liq:paused': 0,

  'offer:created': 10,
  'offer:updated': 50,
  'offer:accepted': 100,
  'offer:unaccepted': 50,
  'offer:cancelled': 50,
  'offer:executed': 300,

  'dispute:created': 50,
  'dispute:committed': 50,
  'dispute:revealed': 200,
  'dispute:executed': 100,

  'ticket:purchased': 200,
  'ticket:cancelled': 0,
  'ticket:drained': 0,
  'ticket:joined': 50,
  'ticket:drafted': 1,
  'ticket:drafter': 1,
  'ticket:undrafted': 0,
  'ticket:undrafter': 1,
  'ticket:slashed': 0,

  'twitter:connect': 1000,
  'discord:connect': 1000,
};
