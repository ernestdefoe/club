import type Model from 'flarum/common/Model';

/** A Marquee title, as far as Club reads it. */
export interface MarqueeMedia extends Model {
  title(): string;
  poster(): string | null;
  kind(): string;
}

/** One part of a pick's schedule. */
export interface Section {
  label: string;
  due: string | null;
}

/** A member's row in a pick's progress list. */
export interface ProgressRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  done: number;
}
