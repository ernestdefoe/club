<?php

namespace Ernestdefoe\Club\Api;

use Carbon\Carbon;
use Ernestdefoe\Club\Club;
use Ernestdefoe\Club\Viewer;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * @extends AbstractDatabaseResource<Club>
 */
class ClubResource extends AbstractDatabaseResource
{
    public function __construct(
        private Viewer $viewer,
        private ConnectionInterface $db,
        private TranslatorInterface $translator
    ) {
    }

    public function type(): string
    {
        return 'clubs';
    }

    public function model(): string
    {
        return Club::class;
    }

    public function scope($query, OriginalContext $context): void
    {
        $context->getActor()->assertCan('viewForum');
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->paginate(20, 50)
                ->defaultSort('-memberCount'),
            Endpoint\Show::make()
                ->defaultInclude(['user', 'picks', 'picks.media', 'picks.discussion']),
            Endpoint\Create::make()
                ->authenticated()
                ->can('ernestdefoe-club.create'),
            Endpoint\Update::make()
                ->authenticated()
                ->can('update'),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete'),
            Endpoint\Endpoint::make('join')
                ->route('POST', '/{id}/membership')
                ->authenticated()
                ->can('ernestdefoe-club.join')
                ->action(fn (Context $context) => $this->join($context->model, $context->getActor())),
            Endpoint\Endpoint::make('leave')
                ->route('DELETE', '/{id}/membership')
                ->authenticated()
                ->action(fn (Context $context) => $this->leave($context->model, $context->getActor())),
        ];
    }

    private function join(Club $club, User $actor): Club
    {
        $this->db->transaction(function () use ($club, $actor) {
            $added = $this->db->table('club_members')->insertOrIgnore([
                'club_id' => $club->id,
                'user_id' => $actor->id,
                'role' => 'member',
                'joined_at' => Carbon::now(),
            ]);

            if ($added) {
                Club::query()->whereKey($club->id)->increment('member_count');
            }
        });

        return $this->changed($club, $actor);
    }

    private function leave(Club $club, User $actor): Club
    {
        $this->db->transaction(function () use ($club, $actor) {
            $members = $this->db->table('club_members')->where('club_id', $club->id);
            $role = (clone $members)->where('user_id', $actor->id)->value('role');

            // A club always keeps someone to run it.
            if ($role === 'host' && (clone $members)->where('role', 'host')->count() === 1) {
                throw new ValidationException(['club' => $this->translator->trans('ernestdefoe-club.api.last_host')]);
            }

            if ($role && (clone $members)->where('user_id', $actor->id)->delete()) {
                // member_count is unsigned: never take it below zero.
                Club::query()->whereKey($club->id)->where('member_count', '>', 0)->decrement('member_count');
            }
        });

        return $this->changed($club, $actor);
    }

    /** The club as it is now, with the actor's new role. */
    private function changed(Club $club, User $actor): Club
    {
        $this->viewer->forget($actor);

        return $club->refresh();
    }

    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Club $model */
        $model->user_id = $context->getActor()->id;
        $model->member_count = 1;

        return $model;
    }

    public function created(object $model, OriginalContext $context): ?object
    {
        /** @var Club $model */
        $actor = $context->getActor();

        $this->db->table('club_members')->insert([
            'club_id' => $model->id,
            'user_id' => $actor->id,
            'role' => 'host',
            'joined_at' => Carbon::now(),
        ]);
        $this->viewer->forget($actor);

        return $model;
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('name')
                ->writable()
                ->requiredOnCreate()
                ->rule('string')
                ->rule('max:100')
                ->rule('regex:/\S/'),
            Schema\Str::make('description')
                ->nullable()
                ->writable()
                ->rule('max:2000'),
            Schema\Integer::make('memberCount'),
            Schema\DateTime::make('createdAt'),
            // host | member | null
            Schema\Str::make('viewerRole')
                ->nullable()
                ->get(fn (Club $club, Context $context) => $this->viewer->role($context->getActor(), $club->id)),
            Schema\Boolean::make('canEdit')
                ->get(fn (Club $club, Context $context) => $context->getActor()->can('update', $club)),
            Schema\Boolean::make('canJoin')
                ->get(fn (Club $club, Context $context) => $context->getActor()->hasPermission('ernestdefoe-club.join')),

            Schema\Relationship\ToOne::make('user')
                ->type('users')
                ->includable(),
            Schema\Relationship\ToMany::make('picks')
                ->type('club-picks')
                ->includable(),
        ];
    }

    public function sorts(): array
    {
        return [
            SortColumn::make('memberCount'),
            SortColumn::make('createdAt'),
        ];
    }
}
