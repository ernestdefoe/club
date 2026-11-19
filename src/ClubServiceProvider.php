<?php

namespace Ernestdefoe\Club;

use Flarum\Foundation\AbstractServiceProvider;

class ClubServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        // One each per request, so every field, policy and post shares their memos.
        $this->container->scoped(Viewer::class);
        $this->container->scoped(SpoilerGate::class);
    }
}
