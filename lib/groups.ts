import { getMovieItemTypeId } from './itemTypes';
import { supabaseAdminClient } from './supabaseAdminClient';

export type MovieRankingGroup = {
  id: string;
  name: string;
  description: string | null;
};

export const fetchMovieRankingGroups = async (): Promise<MovieRankingGroup[]> => {
  const movieItemTypeId = await getMovieItemTypeId();

  const { data, error } = await supabaseAdminClient
    .from('ranking_groups')
    .select('id, name, description')
    .eq('item_type_id', movieItemTypeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rawEntries: unknown[] = Array.isArray(data) ? data : [];

  const groups: MovieRankingGroup[] = [];

  for (const rawEntry of rawEntries) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const { id, name, description } = rawEntry as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
    };

    if (typeof id !== 'string' || typeof name !== 'string') {
      continue;
    }

    groups.push({
      id,
      name,
      description: typeof description === 'string' ? description : null,
    });
  }

  return groups;
};
