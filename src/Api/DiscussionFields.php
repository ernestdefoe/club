<?php

namespace Ernestdefoe\Club\Api;

use Flarum\Api\Schema;

class DiscussionFields
{
    public function __invoke(): array
    {
        return [
            Schema\Relationship\ToOne::make('clubPick')
                ->type('club-picks')
                ->includable(),
        ];
    }
}
