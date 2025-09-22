import { cache } from 'react';

import { supabaseAdminClient } from './supabaseAdminClient';

const MOVIE_SLUG = 'movie';

export const getMovieItemTypeId = cache(async (): Promise<number> => {
  const { data: existingType, error: existingError } = await supabaseAdminClient
    .from('item_types')
    .select('id')
    .eq('slug', MOVIE_SLUG)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingType) {
    return existingType.id;
  }

  const { data: insertedType, error: insertError } = await supabaseAdminClient
    .from('item_types')
    .upsert(
      {
        name: 'Movie',
        slug: MOVIE_SLUG,
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedType.id;
});
