import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Post from 'flarum/common/models/Post';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Select from 'flarum/common/components/Select';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import type ReplyComposer from 'flarum/forum/components/ReplyComposer';
import type { IComposerBodyAttrs } from 'flarum/forum/components/ComposerBody';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import ClubPanel from './components/ClubPanel';
import spoilerNotice from './components/SpoilerNotice';
import type { Section } from './types';
import { replySection } from './schedule';
import { t, text, sectionName } from './util';

export { default as extend } from './extend';

/** The pick of the discussion a reply composer is open on. */
const replyPick = (composer: ReplyComposer) => (composer.attrs as IComposerBodyAttrs & { discussion: Discussion }).discussion.clubPick();

app.initializers.add('ernestdefoe-club', () => {
  addNavigation();
  addPickControls();
  addReplySections();
  gateClosedReplies();
});

/** The Clubs link, and a pick's panel beside its discussion. */
function addNavigation() {
  extend(IndexSidebar.prototype, 'navItems', function (items) {
    items.add(
      'clubs',
      <LinkButton href={app.route('clubs')} icon="fas fa-book-open-reader">
        {t('clubs.nav')}
      </LinkButton>,
      84
    );
  });

  // The schedule and everyone's progress, beside a pick's discussion.
  extend(DiscussionPage.prototype, 'sidebarItems', function (items) {
    const pick = this.discussion && this.discussion.clubPick();
    if (pick) items.add('clubPanel', <ClubPanel pick={pick} />, -50);
  });
}

/** Hosts make a linked discussion their club's pick from its controls. */
function addPickControls() {
  extend(DiscussionControls, 'moderationControls', function (items, discussion) {
    if (!app.session.user || !discussion.marqueeMedia()) return;
    const pick = discussion.clubPick();
    const club = pick && pick.club();
    if (pick && !(club && club.canEdit())) return;

    items.add(
      'clubPick',
      <Button icon="fas fa-book-open-reader" onclick={() => app.modal.show(() => import('./components/PickModal'), { discussion, pick })}>
        {t(pick ? 'controls.edit_pick' : 'controls.make_pick')}
      </Button>,
      -20
    );
  });
}

/** Each reply in a pick's discussion says which section it is about. */
function addReplySections() {
  extend('flarum/forum/components/ReplyComposer', 'headerItems', function (this: ReplyComposer, items: ItemList<Mithril.Children>) {
    const pick = replyPick(this);
    const sections: Section[] = (pick && pick.sections()) || [];
    if (!pick || !sections.length) return;

    const fields = this.composer.fields as { clubSection?: number | null };
    if (fields.clubSection === undefined) fields.clubSection = replySection(pick.viewerDone() || 0, sections.length);

    const options: Record<string, string> = { 0: text('composer.general') };
    sections.forEach((_, i) => (options[i + 1] = sectionName(pick, i + 1)));

    items.add(
      'clubSection',
      <span className="ClubComposerSection">
        <label>{t('composer.about')}</label>
        <Select
          value={String(fields.clubSection || 0)}
          options={options}
          onchange={(value: string) => (fields.clubSection = Number(value) || null)}
        />
      </span>,
      -10
    );
  });

  extend('flarum/forum/components/ReplyComposer', 'data', function (this: ReplyComposer, data: Record<string, unknown>) {
    const fields = this.composer.fields as { clubSection?: number | null };
    if (replyPick(this)) data.clubSection = fields.clubSection || null;
  });

  extend(CommentPost.prototype, 'headerItems', function (items) {
    const post = this.attrs.post;
    const section = post.attribute<number | null>('clubSection');
    const discussion = post.discussion();
    const pick = section && discussion && discussion.clubPick();
    if (section && pick) items.add('clubSection', <span className="ClubSectionBadge">{sectionName(pick, section)}</span>, -10);
  });
}

/** A reply about a section the reader hasn't finished: a notice in place of its text. */
function gateClosedReplies() {
  // A closed reply arrives without its text; never hand Mithril undefined.
  override(Post.prototype, 'contentHtml', function (original) {
    return this.attribute<boolean>('clubClosed') ? '' : original();
  });

  extend(CommentPost.prototype, 'content', function (content) {
    if (this.attrs.post.attribute<boolean>('clubClosed')) content.push(spoilerNotice(this.attrs.post));
  });

  extend(CommentPost.prototype, 'elementAttrs', function (attrs) {
    if (this.attrs.post.attribute<boolean>('clubClosed')) attrs.className = (attrs.className || '') + ' Post--clubClosed';
  });
}
