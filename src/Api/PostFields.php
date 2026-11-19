<?php

namespace Ernestdefoe\Club\Api;

use Ernestdefoe\Club\Pick;
use Ernestdefoe\Club\PostSection;
use Ernestdefoe\Club\SpoilerGate;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Illuminate\Support\Arr;
use WeakMap;

class PostFields
{
    /**
     * The section each post being written will have (null: general), from the
     * moment it is checked until the post is saved. Not a relation: core
     * refreshes the post on save, which reloads its relations.
     *
     * @var WeakMap<Post, array{0: PostSection|null}>
     */
    private WeakMap $pending;

    public function __construct(private SpoilerGate $gate, private TranslatorInterface $translator)
    {
        $this->pending = new WeakMap();
    }

    public function __invoke(): array
    {
        return [
            // Which section of the club's schedule a reply is about.
            Schema\Integer::make('clubSection')
                ->nullable()
                ->get(fn (Post $post, Context $context) => $this->gate->section($post, $context->getActor())?->section)
                ->writable(fn (Post $post, Context $context) => $context->creating() || ($post instanceof CommentPost && $context->getActor()->can('edit', $post)))
                // Checked before the post is saved, stored once it has an id.
                ->set(fn (Post $post, mixed $value, Context $context) => $this->setSection($post, $value, $context))
                ->save(fn (Post $post) => $this->saveSection($post)),
            Schema\Boolean::make('clubClosed')
                ->visible(fn (Post $post, Context $context) => $this->gate->section($post, $context->getActor()) !== null)
                ->get(fn (Post $post, Context $context) => $this->gate->closed($post, $context->getActor())),
        ];
    }

    private function setSection(Post $post, mixed $value, Context $context): void
    {
        if ($value === null || $value === '' || (int) $value === 0) {
            $this->pending[$post] = [null];

            return;
        }

        $discussionId = $post->discussion_id ?: (int) Arr::get($context->body(), 'data.relationships.discussion.data.id');
        $pick = Pick::query()->where('discussion_id', $discussionId)->first();
        $section = (int) $value;

        if (! $pick || $section < 1 || $section > $pick->sectionCount()) {
            throw new ValidationException(['clubSection' => $this->translator->trans('ernestdefoe-club.api.bad_section')]);
        }

        $this->pending[$post] = [new PostSection(['pick_id' => $pick->id, 'section' => $section])];
    }

    private function saveSection(Post $post): void
    {
        [$row] = $this->pending[$post] ?? [null];
        unset($this->pending[$post]);

        if ($row) {
            $row->post_id = $post->id;
            PostSection::query()->upsert([$row->only(['post_id', 'pick_id', 'section'])], ['post_id'], ['pick_id', 'section']);
            $row->exists = true;
        } else {
            PostSection::query()->whereKey($post->id)->delete();
        }

        $post->setRelation('clubSection', $row);
    }
}
