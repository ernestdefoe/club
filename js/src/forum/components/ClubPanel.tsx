import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import progressBar from './ProgressBar';
import type { Club, Pick } from '../models';
import type { ProgressRow, Section } from '../types';
import { setMembership, setProgress } from '../api';
import { current } from '../schedule';
import { t, text, monthName, dueDate, isOverdue } from '../util';

const MEMBERS_SHOWN = 12;

export interface ClubPanelAttrs extends ComponentAttrs {
  pick: Pick;
  /** Every member, not just the first few (the club page). */
  all?: boolean;
}

/**
 * The club side of a pick: its schedule, where you are in it, and how far
 * everyone else has got. In the discussion's sidebar and on the club page.
 */
export default class ClubPanel extends Component<ClubPanelAttrs> {
  saving = false;

  view() {
    const pick = this.attrs.pick;
    const club = pick.club();
    if (!club) return null;

    const sections = pick.sections() || [];
    const member = !!club.viewerRole();
    const done = pick.viewerDone() || 0;

    return (
      <div className="ClubPanel">
        <div className="ClubPanel-head">
          <Link href={app.route('club', { id: club.id() })} className="ClubPanel-club">
            <i className="fas fa-book-open-reader" aria-hidden="true" /> {club.name()}
          </Link>
          <span className="ClubPanel-month">{t('panel.pick_for', { month: monthName(pick.month()) })}</span>
        </div>

        {member ? (
          <div className="ClubPanel-mine">
            {progressBar(done, sections.length, text('panel.your_progress'))}
            <span>{t('panel.done_of', { done, count: sections.length })}</span>
          </div>
        ) : null}

        <ol className="ClubSchedule">{sections.map((section, i) => this.section(section, i + 1, sections.length, member ? done : null))}</ol>

        {member ? null : club.canJoin() && app.session.user ? (
          <Button className="Button Button--primary Button--block" icon="fas fa-user-plus" loading={this.saving} onclick={() => this.join(club)}>
            {t('panel.join', { club: club.name() })}
          </Button>
        ) : (
          <p className="ClubPanel-note">{t('panel.members_only')}</p>
        )}

        {this.members(club, pick.progress() || [], sections.length)}
      </div>
    );
  }

  /** One schedule row; `done` is null for someone not in the club. */
  section(section: Section, n: number, count: number, done: number | null) {
    const member = done !== null;
    const finished = member && done >= n;
    const overdue = !!section.due && !finished && isOverdue(section.due);
    const label = text(finished ? 'panel.unmark' : 'panel.mark', { label: section.label });

    return (
      <li
        className={classList('ClubSchedule-item', {
          'is-done': finished,
          'is-current': member && n === current(done, count) && done < n,
          'is-overdue': overdue,
        })}
      >
        {member ? (
          <Tooltip text={label}>
            <button
              type="button"
              className="ClubSchedule-check"
              aria-pressed={finished ? 'true' : 'false'}
              aria-label={label}
              disabled={this.saving}
              onclick={() => this.mark(finished ? n - 1 : n)}
            >
              <i className={finished ? 'fas fa-check' : 'far fa-circle'} aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <span className="ClubSchedule-number">{n}</span>
        )}
        <span className="ClubSchedule-label">{section.label}</span>
        {section.due ? <time dateTime={section.due}>{t('panel.due', { date: dueDate(section.due) })}</time> : null}
      </li>
    );
  }

  members(club: Club, progress: ProgressRow[], count: number) {
    if (!progress.length) return null;

    return (
      <div className="ClubPanel-members">
        <h4>{t('panel.members', { count: club.memberCount() })}</h4>
        <ul>
          {progress.slice(0, this.attrs.all ? progress.length : MEMBERS_SHOWN).map((row) => (
            <li>
              <Link href={app.route('user', { username: row.username })} className="ClubPanel-member">
                <span className="ClubAvatar" aria-hidden="true">
                  {row.displayName.charAt(0).toUpperCase()}
                  {row.avatarUrl ? <span style={{ backgroundImage: `url("${encodeURI(row.avatarUrl)}")` }} /> : null}
                </span>
                <span className="ClubPanel-memberName">{row.displayName}</span>
              </Link>
              {progressBar(row.done, count, text('panel.member_progress', { name: row.displayName }))}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  mark(done: number) {
    this.saving = true;
    setProgress(this.attrs.pick, done).finally(() => {
      this.saving = false;
      m.redraw();
    });
  }

  join(club: Club) {
    this.saving = true;
    setMembership(club, true)
      .then(() => app.store.find('club-picks', this.attrs.pick.id() as string))
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }
}
