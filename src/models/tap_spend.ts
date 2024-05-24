import Objection from 'objection';
import { randStr } from '../common/common';
import { TapSpendType } from '../controllers/airdrop/constants';
import { BaseModel } from './base';

/**
 * TapSpend represents a spent tap event
 */
export default class TapSpend extends BaseModel {
  userId: string;
  type: TapSpendType;
  amount: string;

  constructor(init?: Partial<TapSpend>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'tap_spend_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TapSpend;
    object.object = 'tap_spend';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'tap_spends';
  }

  static get relationMappings() {
    return {};
  }
}
