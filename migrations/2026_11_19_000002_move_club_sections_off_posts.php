<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Club 1.0 kept each reply's section in a `posts.club_section` column. This
 * moves it to club_post_sections and drops the column. A forum installed
 * after 1.0 never had the column, so there is nothing to move.
 */
return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('posts', 'club_section')) {
            return;
        }

        $db = $schema->getConnection();

        // Only replies in a pick's discussion ever had a section that counted.
        $db->table('club_post_sections')->insertUsing(
            ['post_id', 'pick_id', 'section'],
            $db->table('posts')
                ->join('club_picks', 'club_picks.discussion_id', '=', 'posts.discussion_id')
                ->where('posts.club_section', '>', 0)
                ->select('posts.id', 'club_picks.id', 'posts.club_section')
        );

        $schema->table('posts', function (Blueprint $table) {
            $table->dropColumn('club_section');
        });
    },
    // Back to the 1.0 layout. The column is dropped again by the first
    // migration's down when Club is removed.
    'down' => function (Builder $schema) {
        if (! $schema->hasColumn('posts', 'club_section')) {
            $schema->table('posts', function (Blueprint $table) {
                $table->unsignedTinyInteger('club_section')->nullable();
            });
        }

        $db = $schema->getConnection();

        // One update per section number (at most 31), not one per reply.
        foreach ($db->table('club_post_sections')->distinct()->pluck('section') as $section) {
            $db->table('posts')
                ->whereIn('id', $db->table('club_post_sections')->where('section', $section)->select('post_id'))
                ->update(['club_section' => $section]);
        }
    },
];
