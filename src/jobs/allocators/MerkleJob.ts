import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import MerkleTree from '../../models/merkle_tree';
import Meta from '../../models/meta';
import { Base } from '../base';

const MERKLE_TREE_KEY = 'merkle_tree_root';

/**
 * MerkleJob is responsible for creating the merkle tree, generating the proofs and saving them.
 * Also it updates the root in the meta table.
 * @dev Run this job when it's time to deploy the token.
 */
@Injectable()
export default class MerkleJob extends Base {
  private logger = new Logger(MerkleJob.name);

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/10 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      const existingRoot = await Meta.get(MERKLE_TREE_KEY);
      if (existingRoot) {
        this.logger.log('Merkle tree root already exists');
        return;
      }

      // Prepare the tree values
      const treeValues: [address: string, claimId: number, amount: string][] = [];
      const entries = await MerkleTree.findAll();
      this.logger.log(`Processing ${entries.length} merkle entries`);

      // Load the tree values
      for (const entry of entries) {
        treeValues.push([entry.address, entry.claimId, entry.amount]);
      }

      // Create the merkle tree
      const tree = StandardMerkleTree.of(treeValues, ['address', 'uint', 'uint256']);

      // Create the proofs and save them
      let count = 0;
      for (const entry of entries) {
        const proof = tree.getProof(treeValues[count]);
        await MerkleTree.updateById(entry.id, { proof: JSON.stringify(proof) });
        console.log(`Saved proof for entry ${count}`);
        treeValues[count] = null;
        count++;
      }

      await Meta.update(MERKLE_TREE_KEY, tree.root);
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}
