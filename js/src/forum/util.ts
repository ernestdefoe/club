import app from 'flarum/forum/app';
import extractText from 'flarum/common/utils/extractText';
import type { Pick } from './models';

type Params = Record<string, unknown>;

export const t = (key: string, params: Params = {}) => app.translator.trans(`ernestdefoe-club.forum.${key}`, params);
export const text = (key: string, params: Params = {}) => extractText(t(key, params));

// Core puts dayjs on window (with its locale and plugins) rather than exporting
// it as a module, so it is read here once and nowhere else.
const day = (value?: string) => dayjs(value);

export const monthName = (month: string | null | undefined) => (month ? day(month).format('MMMM YYYY') : '');
export const dueDate = (due: string | null) => (due ? day(due).format('ll') : null);
/** Whether a due date (YYYY-MM-DD) is before today. */
export const isOverdue = (due: string) => day(due).isBefore(day(), 'day');
/** This month, YYYY-MM. */
export const thisMonth = () => day().format('YYYY-MM');

export const apiUrl = (path: string) => `${app.forum.attribute<string>('apiUrl')}/${path}`;

/** "Section 2 · Chapters 6–10" */
export const sectionName = (pick: Pick, n: number) => {
  const section = (pick.sections() || [])[n - 1];
  return section ? text('section.name', { number: n, label: section.label }) : text('section.number', { number: n });
};
