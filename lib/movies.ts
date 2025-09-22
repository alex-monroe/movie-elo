import { supabaseAdminClient } from './supabaseAdminClient';
import { getMovieItemTypeId } from './itemTypes';

export const MOVIE_POSTER_SIZE = 'w342';

export type MovieRecord = {
  id: number;
  name: string;
  image_path: string | null;
  metadata: Record<string, unknown> | null;
};

export const parseMovieReleaseYear = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const typedMetadata = metadata as {
    tmdb?: { release_date?: string | null };
    release_date?: string | null;
    releaseDate?: string | null;
  };

  const releaseDate =
    typedMetadata.tmdb?.release_date ?? typedMetadata.release_date ?? typedMetadata.releaseDate;

  if (typeof releaseDate !== 'string' || releaseDate.length < 4) {
    return null;
  }

  return releaseDate.slice(0, 4);
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
