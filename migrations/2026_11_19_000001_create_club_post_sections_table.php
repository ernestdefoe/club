<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

// Which section of a club pick a reply discusses. No row = a general reply.
return Migration::createTable('club_post_sections', function (Blueprint $table) {
    $table->unsignedInteger('post_id')->primary();
    $table->unsignedInteger('pick_id');
    $table->unsignedTinyInteger('section');

    $table->index('pick_id');
    $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
    $table->foreign('pick_id')->references('id')->on('club_picks')->cascadeOnDelete();
});
