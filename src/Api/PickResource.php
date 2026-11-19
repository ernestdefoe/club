<?php

namespace Ernestdefoe\Club\Api;

use Carbon\Carbon;
use Ernestdefoe\Club\Club;
use Ernestdefoe\Club\Pick;
use Ernestdefoe\Club\PostSection;
use Ernestdefoe\Club\Viewer;
use Ernestdefoe\Marquee\Link;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * A club's pick for a month. Visible only to those who can see its discussion.
 *
 * @extends AbstractDatabaseResource<Pick>
 */
class PickResource extends AbstractDatabaseResource
{
    private const MEMBERS_SHOWN = 100;

    public function __construct(
        private Viewer $viewer,
        private TranslatorInterface $translator,
        private ConnectionInterface $db
    ) {
    }

    public function type(): string
    {
        return 'club-picks';
    }

    public function model(): string
    {
        return Pick::class;
    }

    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereIn('club_picks.discussion_id', Discussion::whereVisibleTo($context->getActor())->select('discussions.id'));
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Show::make()
                ->defaultInclude(['club', 'media', 'discussion']),
            Endpoint\Create::make()
                ->authenticated()
                ->defaultInclude(['club', 'media', 'discussion']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('update')
                ->defaultInclude(['club', 'media']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete'),
            // A member says how many sections they have finished.
            Endpoint\Endpoint::make('progress')
                ->route('POST', '/{id}/progress')
                ->authenticated()
                ->action(fn (Context $context) => $this->saveProgress($context->model, $context->getActor(), (int) Arr::get($context->body(), 'done'))),
        ];
    }

    private function saveProgress(Pick $pick, User $actor, int $done): Pick
    {
        if (! $this->viewer->role($actor, $pick->club_id)) {
            throw new PermissionDeniedException();
        }

        $this->db->table('club_progress')->upsert(
            [['pick_id' => $pick->id, 'user_id' => $actor->id, 'done' => max(0, min($pick->sectionCount(), $done)), 'updated_at' => Carbon::now()]],
            ['pick_id', 'user_id'],
            ['done', 'updated_at']
        );
        $this->viewer->forget($actor);

        return $pick;
    }

    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Pick $model */
        $actor = $context->getActor();
        $club = $model->club;
        $discussion = $model->discussion;

        if (! $club || ! ($actor->hasPermission('ernestdefoe-club.moderate') || $this->viewer->hosts($actor, $club->id))) {
            throw new PermissionDeniedException();
        }

        $mediaId = $discussion ? self::linkedTitle($discussion) : 0;
        if (! $discussion || ! $mediaId || ! Discussion::whereVisibleTo($actor)->whereKey($discussion->id)->exists()) {
            $this->fail('discussion', 'not_linked');
        }

        if (Pick::query()->where('discussion_id', $discussion->id)->exists()) {
            $this->fail('discussion', 'already_a_pick');
        }

        $model->media_id = $mediaId;
        $model->created_at = Carbon::now();

        return $model;
    }

    public function updated(object $model, OriginalContext $context): ?object
    {
        /** @var Pick $model */
        $count = $model->sectionCount();

        // Replies about sections a shortened schedule no longer has move to its
        // last one, so they open once a member finishes it.
        PostSection::query()->where('pick_id', $model->id)->where('section', '>', $count)->update(['section' => $count]);

        return $model;
    }

    /** The title Marquee links the discussion to, 0 for none. */
    private static function linkedTitle(Discussion $discussion): int
    {
        // Marquee 1.20 and older kept the link on `discussions`. Only until a
        // forum updates Marquee: 1.21 refuses older Club releases.
        if (! class_exists(Link::class)) {
            return (int) $discussion->getAttribute('marquee_media_id');
        }

        return (int) Link::query()->whereKey($discussion->id)->value('media_id');
    }

    private function fail(string $field, string $reason): never
    {
        throw new ValidationException([$field => $this->translator->trans("ernestdefoe-club.api.$reason")]);
    }

    public function fields(): array
    {
        return [
            Schema\Date::make('month')
                ->writable()
                ->requiredOnCreate()
                ->set(fn (Pick $pick, mixed $value) => $pick->month = Carbon::parse($value)->startOfMonth()),
            Schema\Arr::make('sections')
                ->writable()
                ->requiredOnCreate()
                ->rule('array')
                ->rule('min:1')
                ->rule('max:'.Club::MAX_SECTIONS)
                ->set(fn (Pick $pick, mixed $value) => $pick->sections = $this->sections($value)),
            // How many sections the viewer has finished; null when not in the club.
            Schema\Integer::make('viewerDone')
                ->nullable()
                ->get(fn (Pick $pick, Context $context) => $this->viewer->role($context->getActor(), $pick->club_id) ? $this->viewer->done($context->getActor(), $pick->id) : null),
            // Every member's progress, on the pick's own page and its discussion.
            Schema\Arr::make('progress')
                ->visible(fn (Pick $pick, Context $context) => $context->showing(self::class) || $context->showing(DiscussionResource::class))
                ->get(fn (Pick $pick, Context $context) => $this->progress($pick, $context->getActor())),

            Schema\Relationship\ToOne::make('club')
                ->type('clubs')
                ->includable()
                ->writableOnCreate()
                ->requiredOnCreate(),
            Schema\Relationship\ToOne::make('discussion')
                ->type('discussions')
                ->includable()
                ->writableOnCreate()
                ->requiredOnCreate(),
            Schema\Relationship\ToOne::make('media')
                ->type('marquee-media')
                ->includable(),
        ];
    }

    /** @return list<array{label: string, due: string|null}> */
    private function sections(mixed $value): array
    {
        $sections = [];

        foreach (array_values((array) $value) as $section) {
            $label = trim((string) (is_array($section) ? ($section['label'] ?? '') : ''));
            $due = is_array($section) ? ($section['due'] ?? null) : null;

            if ($label === '' || mb_strlen($label) > 100) {
                $this->fail('sections', 'section_label');
            }

            if ($due !== null && $due !== '' && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $due)) {
                $this->fail('sections', 'section_due');
            }

            $sections[] = ['label' => $label, 'due' => $due ?: null];
        }

        return $sections;
    }

    /**
     * Members and how far each one is, furthest first. Two queries however many
     * members there are, and User models so display names and avatars come out
     * the way every other part of the forum shows them.
     *
     * @return list<array{id: string, username: string, displayName: string, avatarUrl: string|null, done: int}>
     */
    private function progress(Pick $pick, User $actor): array
    {
        $db = $pick->getConnection();
        // Members with no progress row yet count as 0; PostgreSQL would sort their NULL first.
        $done = 'COALESCE('.$db->getQueryGrammar()->wrap('club_progress.done').', 0)';

        $rows = $db->table('club_members')
            ->leftJoin('club_progress', function ($join) use ($pick) {
                $join->on('club_progress.user_id', '=', 'club_members.user_id')->where('club_progress.pick_id', '=', $pick->id);
            })
            ->where('club_members.club_id', $pick->club_id)
            ->orderByRaw("$done DESC")
            ->orderBy('club_members.joined_at')
            ->limit(self::MEMBERS_SHOWN)
            ->get(['club_members.user_id', 'club_progress.done']);

        $users = User::query()->whereVisibleTo($actor)->whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');

        return $rows->filter(fn ($row) => $users->has($row->user_id))->map(function ($row) use ($users) {
            /** @var User $user */
            $user = $users[$row->user_id];

            return [
                'id' => (string) $user->id,
                'username' => $user->username,
                'displayName' => $user->display_name,
                'avatarUrl' => $user->avatar_url,
                'done' => (int) $row->done,
            ];
        })->values()->all();
    }
}
