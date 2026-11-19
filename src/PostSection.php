<?php

namespace Ernestdefoe\Club;

use Flarum\Database\AbstractModel;

/**
 * Which section of a club pick a reply discusses. A reply with no row is a
 * general one.
 *
 * @property int $post_id
 * @property int $pick_id
 * @property int $section
 */
class PostSection extends AbstractModel
{
    protected $table = 'club_post_sections';

    protected $primaryKey = 'post_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['post_id', 'pick_id', 'section'];

    protected $casts = [
        'post_id' => 'integer',
        'pick_id' => 'integer',
        'section' => 'integer',
    ];
}
