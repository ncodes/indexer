import { BigNumber, ethers, Event, providers } from 'ethers';
import { Handler } from '../handler';
import { Transaction } from 'objection';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';
import * as moment from 'moment';
import * as console from 'console';

export class BadgeManagerHandler extends Handler {
  constructor(private provider: providers.JsonRpcProvider, public network: string, private contracts: JointContracts) {
    super(BadgeManagerHandler.name, null, network, contracts.badgeMgr);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'GrantedBadge',
      async (
        badge: string,
        path: string,
        grantee: string,
        metadataKeys: string[],
        metadataValues: string[],
        expireAt: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onGrantedBadge(badge, path, grantee, metadataKeys, metadataValues, expireAt, event, txn);
      },
    );

    this.on(
      'RevokedBadge',
      async (badge: string, path: string, grantee: string, event: ethers.Event, txn?: Transaction) => {
        return this.onRevokedBadge(badge, path, grantee, event, txn);
      },
    );

    this.on(
      'AddedIssuer',
      async (
        issuer: string,
        badge: string,
        metadataKeys: string[],
        metadataValues: string[],
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onAddedIssuer(issuer, badge, metadataKeys, metadataValues, event, txn);
      },
    );

    this.on(
      'ReplacedIssuer',
      async (oldIssuer: string, newIssuer: string, badge: string, event: ethers.Event, txn?: Transaction) => {
        return this.onReplacedIssuer(oldIssuer, newIssuer, badge, event, txn);
      },
    );

    this.on(
      'PathRegistered',
      async (
        issuer: string,
        badge: string,
        path: string,
        metadataKeys: string[],
        metadataValues: string[],
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onPathRegistered(issuer, badge, path, metadataKeys, metadataValues, event, txn);
      },
    );

    this.on('AddedCoIssuer', async (issuer: string, coIssuer: string, badge: string, event: ethers.Event) => {
      return this.onAddedCoIssuer(issuer, coIssuer, badge, event);
    });

    this.on('RemovedCoIssuer', async (issuer: string, coIssuer: string, badge: string, event: ethers.Event) => {
      return this.onRemovedCoIssuer(issuer, coIssuer, badge, event);
    });

    this.on(
      'BadgeMetaUpdated',
      async (
        issuer: string,
        badge: string,
        path: string,
        key: string,
        value: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onBadgeMetaUpdated(issuer, badge, path, key, value, event, txn);
      },
    );

    this.on(
      'GranteeBadgeMetaUpdated',
      async (
        issuer: string,
        grantee: string,
        badge: string,
        path: string,
        key: string,
        value: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onGranteeBadgeMetaUpdated(issuer, grantee, badge, path, key, value, event, txn);
      },
    );

    this.on(
      'BadgeOwnershipTransferred',
      async (
        badge: string,
        path: string,
        oldOwner: string,
        newOwner: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onBadgeOwnershipTransferred(badge, path, oldOwner, newOwner, event, txn);
      },
    );
  }

  /**
   * Granted badge or path to an address
   * @param badge The badge ID
   * @param path The badge path
   * @param grantee The grantee
   * @param metadataKeys The metadata keys
   * @param metadataValues The metadata values
   * @param expireAt
   * @param event The event object
   * @param txn The transaction object
   */
  async onGrantedBadge(
    badge: string,
    path: string,
    grantee: string,
    metadataKeys: string[],
    metadataValues: string[],
    expireAt: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await BadgeGrant.create(
      {
        network: this.network,
        grantee,
        badge,
        path: path || null,
        expireAt: !expireAt.isZero() ? moment.unix(expireAt.toNumber()).toISOString() : null,
        metadata: (metadataKeys ?? []).reduce((acc, key, index) => {
          acc[key] = metadataValues[index];
          return acc;
        }, {}),
      },
      txn,
    );
  }

  /**
   * Revoked a grantees badge
   * @param badge The badge ID
   * @param path The badge path
   * @param grantee The target grantee
   * @param event The event object
   * @param txn The transaction object
   */
  async onRevokedBadge(badge: string, path: string, grantee: string, event: ethers.Event, txn?: Transaction) {
    await BadgeGrant.deleteByNetAndBadgeAndPath(this.network, badge, path || null, txn);
  }

  /**
   * Issued a new badge
   * @param issuer The issuer address
   * @param badge The badge ID
   * @param metadataKeys The metadata keys
   * @param metadataValues The metadata values
   * @param event The event object
   * @param txn The transaction object
   */
  async onAddedIssuer(
    issuer: string,
    badge: string,
    metadataKeys: string[],
    metadataValues: string[],
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Badge.create(
      {
        network: this.network,
        issuer,
        badge,
        metadata: (metadataKeys ?? []).reduce((acc, key, index) => {
          acc[key] = metadataValues[index];
          return acc;
        }, {}),
      },
      txn,
    );
  }

  /**
   * Replaced the issuer of a badge
   * @param oldIssuer The old issuer address
   * @param newIssuer The new issuer address
   * @param badge The target badge ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onReplacedIssuer(oldIssuer: string, newIssuer: string, badge: string, event: ethers.Event, txn?: Transaction) {
    await Badge.updateByNetAndIssuerAndBadgeAndPath(
      this.network,
      oldIssuer,
      badge,
      undefined,
      { issuer: newIssuer },
      txn,
    );
  }

  /**
   * Registered a new badge path
   * @param issuer The issuer address
   * @param badge The badge ID
   * @param path The path part of the badge
   * @param metadataKeys The metadata keys
   * @param metadataValues The metadata values
   * @param event The event object
   * @param txn The transaction object
   */
  async onPathRegistered(
    issuer: string,
    badge: string,
    path: string,
    metadataKeys: string[],
    metadataValues: string[],
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Badge.create(
      {
        network: this.network,
        issuer,
        badge,
        path,
        metadata: (metadataKeys ?? []).reduce((acc, key, index) => {
          acc[key] = metadataValues[index];
          return acc;
        }, {}),
      },
      txn,
    );
  }

  /**
   * Replaced the issuer of a badge
   * @param issuer The current badge issuer address
   * @param coIssuer The co-issuer address
   * @param badge The target badge ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onAddedCoIssuer(issuer: string, coIssuer: string, badge: string, event: ethers.Event, txn?: Transaction) {
    await Badge.updateByNetAndIssuerAndBadgeAndPath(this.network, issuer, badge, undefined, { coIssuer }, txn);
  }

  /**
   * Removed a co-issuer of a badge
   * @param issuer The current badge issuer address
   * @param coIssuer The co-issuer address
   * @param badge The target badge ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onRemovedCoIssuer(issuer: string, coIssuer: string, badge: string, event: ethers.Event, txn?: Transaction) {
    await Badge.updateByNetAndIssuerAndBadgeAndPath(this.network, issuer, badge, undefined, { coIssuer: null }, txn);
  }

  /**
   * Updated metadata of a badge or path
   * @param issuer The current badge issuer address
   * @param badge The badge ID
   * @param path The badge path
   * @param key The metadata key
   * @param value The metadata value
   * @param event The event object
   * @param txn The transaction object
   */
  async onBadgeMetaUpdated(
    issuer: string,
    badge: string,
    path: string,
    key: string,
    value: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const existing = await Badge.find({
      network: this.network,
      issuer,
      badge,
      path: path || null,
    });
    existing.metadata[key] = value;
    await Badge.updateById(existing.id, { metadata: existing.metadata }, txn);
  }

  /**
   * Updated grantee metadata
   * @param issuer The issuer's address
   * @param grantee The grantee's address
   * @param badge The badge ID
   * @param path The badge path
   * @param key The update key
   * @param value The update value
   * @param event The event object
   * @param txn The transaction object
   */
  async onGranteeBadgeMetaUpdated(
    issuer: string,
    grantee: string,
    badge: string,
    path: string,
    key: string,
    value: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const existing = await BadgeGrant.find(
      {
        network: this.network,
        grantee,
        badge,
        path: path || null,
      },
      txn,
    );
    existing.metadata[key] = value;
    await BadgeGrant.updateById(existing.id, { metadata: existing.metadata }, txn);
    return;
  }

  /**
   * Transferred badge ownership
   * @param badge The badge ID
   * @param path The badge path
   * @param oldOwner The old owner's address
   * @param newOwner The new owner's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onBadgeOwnershipTransferred(
    badge: string,
    path: string,
    oldOwner: string,
    newOwner: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Badge.updateByNetAndIssuerAndBadgeAndPath(
      this.network,
      oldOwner,
      badge,
      path || null,
      { issuer: newOwner },
      txn,
    );
  }
}
