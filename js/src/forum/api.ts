import app from 'flarum/forum/app';
import type { ApiPayloadSingle } from 'flarum/common/Store';
import type Post from 'flarum/common/models/Post';
import type { Club, Pick } from './models';
import { apiUrl } from './util';

/** Join (true) or leave (false) a club; the club model is updated in place. */
export function setMembership(club: Club, join: boolean) {
  return app
    .request<ApiPayloadSingle>({ method: join ? 'POST' : 'DELETE', url: apiUrl(`clubs/${club.id()}/membership`) })
    .then((payload) => app.store.pushPayload(payload));
}

/**
 * Say how many sections of a pick you've finished. Updates the pick (and your
 * row in its member list), then reloads any replies that were closed to you,
 * since some of them may now be open.
 */
export function setProgress(pick: Pick, done: number) {
  return app.request<ApiPayloadSingle>({ method: 'POST', url: apiUrl(`club-picks/${pick.id()}/progress`), body: { done } }).then((payload) => {
    const me = app.session.user;
    const viewerDone = Number(payload.data.attributes?.viewerDone) || 0;
    const progress = (pick.progress() || []).map((row) => (me && row.id === me.id() ? { ...row, done: viewerDone } : row));
    pick.pushAttributes({ viewerDone, progress });

    const discussion = pick.discussion();
    const discussionId = discussion && discussion.id();
    const closed = app.store
      .all<Post>('posts')
      .filter((post) => {
        const postDiscussion = post.discussion();
        return post.attribute<boolean>('clubClosed') && postDiscussion && postDiscussion.id() === discussionId;
      })
      .map((post) => post.id() as string);

    return closed.length ? app.store.find('posts', closed) : null;
  });
}
