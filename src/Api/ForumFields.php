<?php

namespace Ernestdefoe\Club\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;

class ForumFields
{
    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canStartClub')
                ->get(fn (object $forum, Context $context) => $context->getActor()->hasPermission('ernestdefoe-club.create')),
        ];
    }
}
