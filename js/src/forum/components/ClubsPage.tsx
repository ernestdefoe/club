import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import PageStructure from 'flarum/forum/components/PageStructure';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import extractText from 'flarum/common/utils/extractText';
import type Mithril from 'mithril';
import type { IPageAttrs } from 'flarum/common/components/Page';
import ClubEditModal from './ClubEditModal';
import type { Club } from '../models';
import { t } from '../util';

/** /clubs: every club, biggest first, with what each is on now. */
export default class ClubsPage extends Page {
  clubs: Club[] | null = null;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);
    app.history.push('clubs', extractText(t('clubs.title')));

    app.store.find<Club[]>('clubs', { page: { limit: 50 } }).then((clubs) => {
      this.clubs = clubs;
      m.redraw();
    });
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);
    app.setTitle(extractText(t('clubs.title')));
  }

  view() {
    return (
      <PageStructure className="ClubsPage" sidebar={() => <IndexSidebar />}>
        <div className="IndexPage-toolbar ClubsPage-toolbar">
          <h2>{t('clubs.title')}</h2>
          {app.forum.attribute<boolean>('canStartClub') ? (
            <Button className="Button Button--primary" icon="fas fa-plus" onclick={() => app.modal.show(ClubEditModal)}>
              {t('clubs.start')}
            </Button>
          ) : null}
        </div>
        {this.clubs === null ? (
          <LoadingIndicator display="block" />
        ) : this.clubs.length ? (
          <ul className="ClubCards">{this.clubs.map((club) => this.card(club))}</ul>
        ) : (
          <Placeholder text={t('clubs.none')} />
        )}
      </PageStructure>
    );
  }

  card(club: Club) {
    const role = club.viewerRole();

    return (
      <li>
        <Link className="ClubCard" href={app.route('club', { id: club.id() })}>
          <span className="ClubCard-icon" aria-hidden="true">
            <i className="fas fa-book-open-reader" />
          </span>
          <b>{club.name()}</b>
          <small>
            {t('clubs.members', { count: club.memberCount() })}
            {role ? <> · {t(`clubs.role_${role}`)}</> : null}
          </small>
          {club.description() ? <p>{club.description()}</p> : null}
        </Link>
      </li>
    );
  }
}
