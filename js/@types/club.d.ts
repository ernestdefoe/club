import type { Pick } from '../src/forum/models';
import type { MarqueeMedia } from '../src/forum/types';

// What src/forum/extend.ts and Marquee add to core's Discussion model.
declare module 'flarum/common/models/Discussion' {
  export default interface Discussion {
    clubPick(): Pick | false;
    marqueeMedia(): MarqueeMedia | false;
  }
}
