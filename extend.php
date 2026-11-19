<?php

use Ernestdefoe\Club\Access\ClubPolicy;
use Ernestdefoe\Club\Api;
use Ernestdefoe\Club\Club;
use Ernestdefoe\Club\ClubServiceProvider;
use Ernestdefoe\Club\Pick;
use Ernestdefoe\Club\PostSection;
use Ernestdefoe\Club\SpoilerGate;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Tobyz\JsonApiServer\Schema\Field\Field;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        ->route('/clubs', 'clubs')
        ->route('/clubs/{id:\d+}', 'club'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\ServiceProvider())
        ->register(ClubServiceProvider::class),

    (new Extend\Model(Discussion::class))
        ->hasOne('clubPick', Pick::class, 'discussion_id'),

    (new Extend\Model(Post::class))
        ->hasOne('clubSection', PostSection::class, 'post_id'),

    new Extend\ApiResource(Api\ClubResource::class),
    new Extend\ApiResource(Api\PickResource::class),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(Api\DiscussionFields::class)
        ->endpoint(Endpoint\Show::class, fn (Endpoint\Show $endpoint) => $endpoint->addDefaultInclude(['clubPick', 'clubPick.club'])->eagerLoad(['firstPost.clubSection', 'lastPost.clubSection']))
        ->endpoint(Endpoint\Index::class, fn (Endpoint\Index $endpoint) => $endpoint->eagerLoad(['mostRelevantPost.clubSection'])),

    (new Extend\ApiResource(PostResource::class))
        ->fields(Api\PostFields::class)
        // The spoiler gate reads each post's section: one query for the whole page.
        ->endpoint(
            [Endpoint\Index::class, Endpoint\Show::class, Endpoint\Create::class, Endpoint\Update::class],
            fn (Endpoint\Index|Endpoint\Show|Endpoint\Create|Endpoint\Update $endpoint) => $endpoint->eagerLoad(['clubSection'])
        )
        // A reply about a section the viewer hasn't finished arrives without its text.
        ->field('contentHtml', fn (Field $field) => $field->visible(
            fn (Post $post, Context $context) => $post instanceof CommentPost && ! resolve(SpoilerGate::class)->closed($post, $context->getActor())
        )),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(Api\ForumFields::class),

    // flarum/mentions includes the replies that mention each post.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-mentions', fn () => [
            (new Extend\ApiResource(PostResource::class))
                ->endpoint(
                    [Endpoint\Index::class, Endpoint\Show::class],
                    fn (Endpoint\Index|Endpoint\Show $endpoint) => $endpoint->eagerLoadWhenIncluded(['mentionedBy' => ['mentionedBy.clubSection']])
                ),
        ]),

    (new Extend\Policy())
        ->modelPolicy(Club::class, ClubPolicy::class)
        ->modelPolicy(Pick::class, ClubPolicy::class),
];
