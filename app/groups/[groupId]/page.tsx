import { notFound } from 'next/navigation';

import MovieComparisonArena from './MovieComparisonArena';

import { getMovieItemTypeId } from '@/lib/itemTypes';
import { supabaseAdminClient } from '@/lib/supabaseAdminClient';
import { getTmdbConfiguration } from '@/lib/tmdb';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const revalidate = 0;

const isValidUuid = (value: string) => UUID_REGEX.test(value);

type GroupPageProps = {
  params: { groupId: string };
};

type GroupRecord = {
  id: string;
  name: string;
  description: string | null;
  item_type_id: number;
};

const fetchGroupRecord = async (groupId: string): Promise<GroupRecord> => {
  const { data, error } = await supabaseAdminClient
    .from('ranking_groups')
    .select('id, name, description, item_type_id')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  return data as GroupRecord;
};

const fetchGroupItemCount = async (groupId: string): Promise<number> => {
  const { count, error } = await supabaseAdminClient
    .from('group_items')
    .select('item_id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

export default async function GroupComparisonPage({ params }: GroupPageProps) {
  const { groupId } = params;

  if (!groupId || !isValidUuid(groupId)) {
    notFound();
  }

  const [movieItemTypeId, groupRecord] = await Promise.all([
    getMovieItemTypeId(),
    fetchGroupRecord(groupId),
  ]);

  if (groupRecord.item_type_id !== movieItemTypeId) {
    notFound();
  }

  const [movieCount, tmdbConfig] = await Promise.all([
    fetchGroupItemCount(groupId),
    getTmdbConfiguration(),
  ]);

  return (
    <main className="min-h-screen bg-gray-900 px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-blue-300">Movie Rankings</p>
            <h1 className="text-4xl font-bold sm:text-5xl">{groupRecord.name}</h1>
          </div>
          {groupRecord.description ? (
            <p className="text-lg text-gray-300">{groupRecord.description}</p>
          ) : (
            <p className="text-lg text-gray-300">
              Pick the movie you prefer in each matchup to shape your personal Elo rankings for this group.
            </p>
          )}
        </header>

        <MovieComparisonArena
          groupId={groupId}
          groupName={groupRecord.name}
          movieCount={movieCount}
          tmdbConfig={tmdbConfig}
        />
      </div>
    </main>
  );
}
