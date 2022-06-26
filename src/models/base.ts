import Objection, { Model } from 'objection';
import * as moment from 'moment';
import objectionSoftDelete from 'objection-js-soft-delete';

const softDelete = objectionSoftDelete({
  columnName: 'deletedAt',
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class BaseModel extends softDelete(Model) {
  // The serial number (primary key)
  sn: number;
  // The unique public ID of the record
  id: string = undefined;
  // The date & time of creation
  createdAt: string = undefined;
  // The date & time of update
  updatedAt: string = undefined;
  // The date & time of deletion
  deletedAt: string = undefined;
  // The object name of the record
  object: string;

  $beforeInsert() {
    if (!this.createdAt) this.createdAt = moment().utc().toISOString();
    if (!this.updatedAt) this.updatedAt = this.createdAt;
  }

  $beforeUpdate() {
    this.updatedAt = moment().utc().toISOString();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    delete json.sn;
    delete json.deletedAt;
    return json;
  }

  getID() {
    return this.id;
  }
}
