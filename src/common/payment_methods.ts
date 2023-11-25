import { SupportedNetworks } from '../network/common';

export const paymentMethods: {
  [key: string]: { badge: string; name: string; shortName?: string; logoUrl: string; region: string }[];
} = {
  [SupportedNetworks.Ethereum]: [
    {
      badge: 'pm/bank_transfer',
      name: 'Bank Transfer',
      region: 'ALL',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/BankTransfer.svg',
    },
    {
      badge: 'pm/gtb',
      name: 'Guaranty Trust Bank',
      shortName: 'GTB',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/first_bank',
      name: 'First Bank',
      shortName: 'FBN',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/zenith',
      name: 'Zenith Bank',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/sterling_bank',
      name: 'Sterling Bank',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/union_bank',
      name: 'Union Bank of Nigeria',
      shortName: 'UBN',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
  ],
  [SupportedNetworks.Sepolia]: [
    {
      badge: 'pm/bank_transfer',
      name: 'Bank Transfer',
      region: 'ALL',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/BankTransfer.svg',
    },
    {
      badge: 'pm/gtb',
      name: 'Guaranty Trust Bank',
      shortName: 'GTB',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/first_bank',
      name: 'First Bank',
      shortName: 'FBN',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/zenith',
      name: 'Zenith Bank',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/sterling_bank',
      name: 'Sterling Bank',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
    {
      badge: 'pm/union_bank',
      name: 'Union Bank of Nigeria',
      shortName: 'UBN',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
  ],
  [SupportedNetworks.Localhost]: [
    {
      badge: 'pm/bank_transfer',
      name: 'Bank Transfer',
      region: 'ALL',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/BankTransfer.svg',
    },
    {
      badge: 'pm/gtb',
      name: 'Guaranty Trust Bank',
      shortName: 'GTB',
      region: 'NG',
      logoUrl: 'https://storage.googleapis.com/joint-images/payment-methods/GTBank.svg',
    },
  ],
};
