import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type { MarqueeMedia, ProgressRow, Section } from './types';

export class Club extends Model {
  name() {
    return Model.attribute<string>('name').call(this);
  }
  description() {
    return Model.attribute<string | null>('description').call(this);
  }
  memberCount() {
    return Model.attribute<number>('memberCount').call(this);
  }
  createdAt() {
    return Model.attribute('createdAt', Model.transformDate).call(this);
  }
  /** host | member | null */
  viewerRole() {
    return Model.attribute<'host' | 'member' | null>('viewerRole').call(this);
  }
  canEdit() {
    return Model.attribute<boolean>('canEdit').call(this);
  }
  canJoin() {
    return Model.attribute<boolean>('canJoin').call(this);
  }
  user() {
    return Model.hasOne<User>('user').call(this);
  }
  picks() {
    return Model.hasMany<Pick>('picks').call(this);
  }
}

export class Pick extends Model {
  month() {
    return Model.attribute<string>('month').call(this);
  }
  sections() {
    return Model.attribute<Section[]>('sections').call(this);
  }
  /** Sections the viewer has finished; null when not in the club. */
  viewerDone() {
    return Model.attribute<number | null>('viewerDone').call(this);
  }
  progress() {
    return Model.attribute<ProgressRow[] | undefined>('progress').call(this);
  }
  club() {
    return Model.hasOne<Club>('club').call(this);
  }
  discussion() {
    return Model.hasOne<Discussion>('discussion').call(this);
  }
  media() {
    return Model.hasOne<MarqueeMedia>('media').call(this);
  }
}
