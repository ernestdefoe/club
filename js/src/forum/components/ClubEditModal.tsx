import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import type { Club } from '../models';
import { t } from '../util';

export interface ClubEditModalAttrs extends IFormModalAttrs {
  club?: Club;
}

/** Start a club, or rename and describe one. */
export default class ClubEditModal extends FormModal<ClubEditModalAttrs> {
  name = '';
  description = '';

  oninit(vnode: Mithril.Vnode<ClubEditModalAttrs, this>) {
    super.oninit(vnode);
    const club = this.attrs.club;
    this.name = club ? club.name() : '';
    this.description = (club && club.description()) || '';
  }

  className() {
    return 'ClubEditModal Modal--small';
  }

  title() {
    return t(this.attrs.club ? 'club.edit_title' : 'club.new_title');
  }

  content() {
    return (
      <div className="Modal-body">
        <div className="Form">
          <div className="Form-group">
            <label for="club-name">{t('club.name_label')}</label>
            <input
              id="club-name"
              className="FormControl"
              maxlength="100"
              required
              value={this.name}
              oninput={(e: InputEvent) => (this.name = (e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="Form-group">
            <label for="club-description">{t('club.description_label')}</label>
            <textarea
              id="club-description"
              className="FormControl"
              rows="4"
              maxlength="2000"
              value={this.description}
              oninput={(e: InputEvent) => (this.description = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div className="Form-group">
            <Button type="submit" className="Button Button--primary Button--block" loading={this.loading} disabled={!this.name.trim()}>
              {t('club.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    this.loading = true;

    const isNew = !this.attrs.club;
    const club = this.attrs.club || app.store.createRecord<Club>('clubs');

    club.save({ name: this.name.trim(), description: this.description.trim() || null }).then((saved) => {
      this.hide();
      if (isNew) m.route.set(app.route('club', { id: saved.id() }));
    }, this.loaded.bind(this));
  }
}
