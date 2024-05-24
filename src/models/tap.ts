import Objection from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * Tap represents a tap event
 */
export default class Tap extends BaseModel {
  userId: string;
  virtual: boolean;
  bonusName: string;
  bonus: boolean;
  bonusValue: string;
  battleId: string;
  battleSide: string;

  constructor(init?: Partial<Tap>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'tap_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Tap;
    object.object = 'tap';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'taps';
  }

  static get relationMappings() {
    return {};
  }
}
