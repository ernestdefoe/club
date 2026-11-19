<?php

namespace Ernestdefoe\Club;

use Flarum\Post\Post;
use Flarum\User\User;
use WeakMap;

/**
 * A reply about section N of a club pick stays closed to anyone who hasn't
 * finished section N, so the text never reaches their browser. Your own
 * replies are always open to you.
 */
class SpoilerGate
{
    /**
     * Ids of the discussions that are picks, per actor (so per request), for
     * posts that arrive without their section loaded.
     *
     * @var WeakMap<User, array<true>> keyed by discussion id
     */
    private WeakMap $pickDiscussions;

    public function __construct(private Viewer $viewer)
    {
        $this->pickDiscussions = new WeakMap();
    }

    public function closed(Post $post, User $actor): bool
    {
        $section = $this->section($post, $actor);

        if (! $section || $post->user_id === $actor->id) {
            return false;
        }

        return $this->viewer->done($actor, $section->pick_id) < $section->section;
    }

    /** The section a reply is about; null for a general one. */
    public function section(Post $post, User $actor): ?PostSection
    {
        // Post lists load every post's section in one query (extend.php). A post
        // serialized another way (a notification's subject, a flagged post) is
        // looked up only when its discussion is a pick. Picks are few (about one
        // a month per club), so knowing which discussions they are is one small
        // query per request.
        if (! $post->relationLoaded('clubSection')) {
            $this->pickDiscussions[$actor] ??= array_fill_keys(Pick::query()->pluck('discussion_id')->all(), true);

            if (! isset($this->pickDiscussions[$actor][$post->discussion_id])) {
                return null;
            }
        }

        $section = $post->clubSection;

        return $section instanceof PostSection ? $section : null;
    }
}
