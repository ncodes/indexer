import { AbiCoder, keccak256, Wallet } from 'ethers';

export function getClaimSig(
  key: string,
  beneficiary: string,
  amount: string,
  claimId: string | number,
  nonce: string | number,
  chainId = 31337,
) {
  const signer = new Wallet(key);
  const msgHash = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['uint', 'address', 'uint256', 'uint', 'uint'],
      [chainId, beneficiary, amount, claimId, nonce],
    ),
  );
  const msgHashBytes = Buffer.from(msgHash.substring(2), 'hex');
  return signer.signMessage(msgHashBytes);
}
