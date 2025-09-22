import { MOVIE_POSTER_SIZE, parseMovieReleaseYear } from './movieMetadata';
import { getMovieItemTypeId } from './itemTypes';
import { supabaseAdminClient } from './supabaseAdminClient';

export type MovieRecord = {
  id: number;
  name: string;
  image_path: string | null;
  metadata: Record<string, unknown> | null;
};

export const fetchMovieRecords = async (): Promise<MovieRecord[]> => {
  const movieItemTypeId = await getMovieItemTypeId();

  const { data, error } = await supabaseAdminClient
    .from('rankable_items')
    .select('id, name, image_path, metadata')
    .eq('item_type_id', movieItemTypeId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MovieRecord[];
};

export { MOVIE_POSTER_SIZE, parseMovieReleaseYear };
