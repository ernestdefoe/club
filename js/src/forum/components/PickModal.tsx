import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Select from 'flarum/common/components/Select';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
import type { Club, Pick } from '../models';
import type { Section } from '../types';
import { splitMonth } from '../schedule';
import { t, text, thisMonth } from '../util';

const MAX = 31;

export interface PickModalAttrs extends IFormModalAttrs {
  discussion: Discussion;
  pick?: Pick | false;
}

/** Make a Marquee-linked discussion a club's pick for a month, with its schedule. */
export default class PickModal extends FormModal<PickModalAttrs> {
  clubs: Club[] | null = null;
  clubId: string | null = null;
  month = '';
  sections: Section[] = [];
  parts = 4;

  oninit(vnode: Mithril.Vnode<PickModalAttrs, this>) {
    super.oninit(vnode);

    const pick = this.attrs.pick;
    const club = pick && pick.club();
    this.clubId = club ? (club.id() as string) : null;
    this.month = pick ? pick.month().slice(0, 7) : thisMonth();
    this.sections = pick ? pick.sections().map((s) => ({ ...s })) : [];

    if (!pick) {
      app.store.find<Club[]>('clubs', { page: { limit: 50 } }).then((clubs) => {
        this.clubs = clubs.filter((club) => club.canEdit());
        if (this.clubs.length) this.clubId = this.clubs[0].id() as string;
        m.redraw();
      });
    }
    if (!this.sections.length) this.split();
  }

  className() {
    return 'ClubPickModal';
  }

  title() {
    return t(this.attrs.pick ? 'pick.edit_title' : 'pick.title', { title: <em>{this.attrs.discussion.title()}</em> });
  }

  split() {
    const media = this.attrs.discussion.marqueeMedia();
    const kind = media ? media.kind() : null;
    const unit = kind === 'tv' ? 'week' : 'part';
    this.sections = splitMonth(`${this.month}-01`, this.parts, (n) => text(`pick.default_${unit}`, { number: n }));
  }

  content() {
    if (!this.attrs.pick && this.clubs === null)
      return (
        <div className="Modal-body">
          <LoadingIndicator />
        </div>
      );
    if (!this.attrs.pick && !this.clubs?.length)
      return (
        <div className="Modal-body">
          <p>{t('pick.no_clubs')}</p>
        </div>
      );

    return (
      <div className="Modal-body">
        <div className="Form">
          {this.clubField()}
          <div className="Form-group">
            <label for="club-pick-month">{t('pick.month_label')}</label>
            <input
              id="club-pick-month"
              className="FormControl"
              type="month"
              required
              value={this.month}
              oninput={(e: InputEvent) => (this.month = (e.target as HTMLInputElement).value)}
            />
          </div>

          {this.scheduleField()}

          <div className="Form-group">
            <Button type="submit" className="Button Button--primary Button--block" loading={this.loading}>
              {t(this.attrs.pick ? 'pick.save' : 'pick.create')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /** Which club the pick is for; fixed once it exists. */
  clubField() {
    if (this.attrs.pick || !this.clubs) return null;

    return (
      <div className="Form-group">
        <label>{t('pick.club_label')}</label>
        <Select
          value={this.clubId}
          options={Object.fromEntries(this.clubs.map((club) => [club.id(), club.name()]))}
          onchange={(value: string) => (this.clubId = value)}
        />
      </div>
    );
  }

  scheduleField() {
    return (
      <div className="Form-group">
        <label>{t('pick.schedule_label')}</label>
        <p className="helpText">{t('pick.schedule_help')}</p>
        <div className="ClubPickModal-split">
          <span>{t('pick.split_into')}</span>
          <input
            className="FormControl"
            type="number"
            min="1"
            max={MAX}
            value={this.parts}
            aria-label={text('pick.parts_label')}
            oninput={(e: InputEvent) => (this.parts = Math.max(1, Math.min(MAX, Number((e.target as HTMLInputElement).value) || 1)))}
          />
          <Button className="Button" onclick={() => this.split()}>
            {t('pick.split_button')}
          </Button>
        </div>
        <ol className="ClubPickModal-sections">{this.sections.map((section, i) => this.sectionRow(section, i))}</ol>
        {this.sections.length < MAX ? (
          <Button className="Button Button--link" icon="fas fa-plus" onclick={() => this.sections.push({ label: '', due: null })}>
            {t('pick.add_section')}
          </Button>
        ) : null}
      </div>
    );
  }

  sectionRow(section: Section, i: number) {
    return (
      <li key={i}>
        <input
          className="FormControl"
          maxlength="100"
          required
          value={section.label}
          aria-label={text('pick.section_label', { number: i + 1 })}
          placeholder={text('pick.section_placeholder')}
          oninput={(e: InputEvent) => (section.label = (e.target as HTMLInputElement).value)}
        />
        <input
          className="FormControl"
          type="date"
          value={section.due || ''}
          aria-label={text('pick.due_label', { number: i + 1 })}
          oninput={(e: InputEvent) => (section.due = (e.target as HTMLInputElement).value || null)}
        />
        <Button
          className="Button Button--icon"
          icon="fas fa-times"
          aria-label={text('pick.remove_section', { number: i + 1 })}
          disabled={this.sections.length === 1}
          onclick={() => this.sections.splice(i, 1)}
        />
      </li>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    this.loading = true;

    const discussion = this.attrs.discussion;
    const pick = this.attrs.pick || app.store.createRecord<Pick>('club-picks');
    const club = this.clubId ? app.store.getById<Club>('clubs', this.clubId) : undefined;
    const attributes = { month: `${this.month}-01`, sections: this.sections.map((s) => ({ label: s.label.trim(), due: s.due || null })) };

    pick
      .save(this.attrs.pick ? attributes : { ...attributes, relationships: { club: club || null, discussion } })
      .then((saved) => {
        // The discussion page reads its pick through the relationship.
        discussion.pushData({ relationships: { clubPick: { data: { type: 'club-picks', id: saved.id() as string } } } });
        // Members' progress comes with the pick's own page; fetch it once.
        return app.store.find('club-picks', saved.id() as string);
      })
      .then(() => {
        this.hide();
        m.redraw();
      }, this.loaded.bind(this));
  }
}
