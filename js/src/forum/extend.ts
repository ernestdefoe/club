import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
import { Club, Pick } from './models';

export default [
  new Extend.Routes().add('clubs', '/clubs', () => import('./components/ClubsPage')).add('club', '/clubs/:id', () => import('./components/ClubPage')),

  new Extend.Store().add('clubs', Club).add('club-picks', Pick),

  new Extend.Model(Discussion).hasOne<Pick>('clubPick'),
];
