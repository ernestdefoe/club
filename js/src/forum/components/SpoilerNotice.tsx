import Button from 'flarum/common/components/Button';
import type Post from 'flarum/common/models/Post';
import { setProgress } from '../api';
import { t, sectionName } from '../util';

/** In place of a reply about a section the reader hasn't finished. */
export default function spoilerNotice(post: Post) {
  const discussion = post.discussion();
  const pick = discussion && discussion.clubPick();
  const section = post.attribute<number>('clubSection');
  const club = pick && pick.club();
  const member = club && club.viewerRole();

  return (
    <div className="ClubSpoiler">
      <i className="fas fa-eye-slash" aria-hidden="true" />
      <div>
        <b>{t('spoiler.title', { section: pick ? sectionName(pick, section) : section })}</b>
        <p>{t(member ? 'spoiler.body_member' : 'spoiler.body')}</p>
        {pick && member ? (
          <Button className="Button" onclick={() => setProgress(pick, section).then(() => m.redraw())}>
            {t('spoiler.finished', { section: sectionName(pick, section) })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
