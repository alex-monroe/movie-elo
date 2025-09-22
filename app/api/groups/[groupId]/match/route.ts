import { NextResponse } from 'next/server';

import { getMovieItemTypeId } from '@/lib/itemTypes';
import { supabaseAdminClient } from '@/lib/supabaseAdminClient';

const DEFAULT_RATING = 1200;
const MIN_NEW_ITEM_COMPARISONS = 5;
const DISCOVERY_MATCH_PROBABILITY = 0.15;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extractBearerToken = (request: Request): string | null => {
  const authorizationHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorizationHeader) {
    return null;
  }

  const normalizedHeader = authorizationHeader.trim();

  if (!normalizedHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = normalizedHeader.slice('bearer '.length).trim();

  return token.length > 0 ? token : null;
};

const isValidUuid = (value: string) => UUID_REGEX.test(value);

type SupabaseGroupItem = {
  item_id: number;
  rankable_items: {
    id: number;
    name: string;
    image_path: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
};

type SupabaseRatingRow = {
  item_id: number;
  rating: string | number;
  comparison_count: number;
};

type MatchItem = {
  itemId: number;
  name: string;
  imagePath: string | null;
  metadata: Record<string, unknown> | null;
  rating: number;
  comparisonCount: number;
};

const normalizeRating = (value: string | number | null | undefined): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return DEFAULT_RATING;
};

const randomIndex = (length: number) => Math.floor(Math.random() * length);

const selectRandomPair = (items: MatchItem[]): [MatchItem, MatchItem] => {
  const pool = [...items];
  const firstIndex = randomIndex(pool.length);
  const [first] = pool.splice(firstIndex, 1);
  const secondIndex = randomIndex(pool.length);
  const [second] = pool.splice(secondIndex, 1);

  return [first, second];
};

const selectAdjacentByRating = (items: MatchItem[]): [MatchItem, MatchItem] => {
  if (items.length <= 2) {
    return [items[0], items[1]];
  }

  const sorted = [...items].sort((a, b) => a.rating - b.rating);
  let bestPair: [MatchItem, MatchItem] = [sorted[0], sorted[1]];
  let smallestDiff = Math.abs(sorted[1].rating - sorted[0].rating);

  for (let index = 1; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const diff = Math.abs(next.rating - current.rating);

    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestPair = [current, next];
    }
  }

  return bestPair;
};

const selectDiscoveryPair = (items: MatchItem[]): [MatchItem, MatchItem] => {
  if (items.length <= 2) {
    return [items[0], items[1]];
  }

  const sorted = [...items].sort((a, b) => a.rating - b.rating);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return [first, last];
};

const chooseMatchup = (items: MatchItem[]): [MatchItem, MatchItem] | null => {
  if (items.length < 2) {
    return null;
  }

  const lowHistoryItems = items.filter((item) => item.comparisonCount < MIN_NEW_ITEM_COMPARISONS);

  if (lowHistoryItems.length >= 2) {
    return selectRandomPair(lowHistoryItems);
  }

  const shouldExplore = Math.random() < DISCOVERY_MATCH_PROBABILITY;

  if (shouldExplore) {
    return selectDiscoveryPair(items);
  }

  return selectAdjacentByRating(items);
};

const shuffleOrientation = (pair: [MatchItem, MatchItem]): [MatchItem, MatchItem] => {
  return Math.random() < 0.5 ? pair : [pair[1], pair[0]];
};

const buildMatchItems = (
  groupItems: SupabaseGroupItem[],
  ratingRows: SupabaseRatingRow[]
): MatchItem[] => {
  const ratingMap = new Map<number, SupabaseRatingRow>();

  for (const row of ratingRows) {
    ratingMap.set(row.item_id, row);
  }

  const items: MatchItem[] = [];

  for (const groupItem of groupItems) {
    if (!groupItem.rankable_items) {
      continue;
    }

    const ratingRow = ratingMap.get(groupItem.item_id);

    items.push({
      itemId: groupItem.rankable_items.id,
      name: groupItem.rankable_items.name,
      imagePath: groupItem.rankable_items.image_path,
      metadata: groupItem.rankable_items.metadata,
      rating: normalizeRating(ratingRow?.rating),
      comparisonCount: ratingRow?.comparison_count ?? 0,
    });
  }

  return items;
};

export async function GET(
  request: Request,
  context: { params: { groupId: string } }
): Promise<NextResponse> {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  const { groupId } = context.params;

  if (!groupId || !isValidUuid(groupId)) {
    return NextResponse.json({ error: 'Provide a valid group identifier.' }, { status: 400 });
  }

  const { data: userResult, error: userError } = await supabaseAdminClient.auth.getUser(token);

  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'User session could not be verified.' }, { status: 401 });
  }

  try {
    const userId = userResult.user.id;

    const { data: group, error: groupError } = await supabaseAdminClient
      .from('ranking_groups')
      .select('id, item_type_id')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      throw groupError;
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
    }

    const movieItemTypeId = await getMovieItemTypeId();

    if (group.item_type_id !== movieItemTypeId) {
      return NextResponse.json({ error: 'Only movie groups support matchups right now.' }, { status: 400 });
    }

    const { error: participantError } = await supabaseAdminClient
      .from('group_participants')
      .upsert(
        { group_id: groupId, user_id: userId },
        { onConflict: 'user_id,group_id' }
      );

    if (participantError) {
      throw participantError;
    }

    const { data: groupItems, error: groupItemsError } = await supabaseAdminClient
      .from('group_items')
      .select('item_id, rankable_items!inner(id, name, image_path, metadata)')
      .eq('group_id', groupId);

    if (groupItemsError) {
      throw groupItemsError;
    }

    if (!groupItems || groupItems.length < 2) {
      return NextResponse.json(
        { error: 'At least two movies are required to start ranking this group.' },
        { status: 400 }
      );
    }

    const { data: ratingRows, error: ratingsError } = await supabaseAdminClient
      .from('user_group_item_ratings')
      .select('item_id, rating, comparison_count')
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (ratingsError) {
      throw ratingsError;
    }

    const items = buildMatchItems(groupItems as SupabaseGroupItem[], (ratingRows ?? []) as SupabaseRatingRow[]);
    const matchup = chooseMatchup(items);

    if (!matchup) {
      return NextResponse.json(
        { error: 'At least two movies are required to start ranking this group.' },
        { status: 400 }
      );
    }

    const [first, second] = shuffleOrientation(matchup);

    return NextResponse.json({
      matchup: [
        {
          itemId: first.itemId,
          name: first.name,
          imagePath: first.imagePath,
          metadata: first.metadata,
          rating: first.rating,
          comparisonCount: first.comparisonCount,
        },
        {
          itemId: second.itemId,
          name: second.name,
          imagePath: second.imagePath,
          metadata: second.metadata,
          rating: second.rating,
          comparisonCount: second.comparisonCount,
        },
      ],
    });
  } catch (error) {
    console.error('Failed to build matchup for group:', error);
    return NextResponse.json({ error: 'Failed to generate the next matchup.' }, { status: 500 });
  }
}

type ComparisonRequestBody = {
  winnerItemId?: unknown;
  loserItemId?: unknown;
};

const parseComparisonBody = (
  payload: ComparisonRequestBody
): { winnerItemId: number; loserItemId: number } | null => {
  const { winnerItemId, loserItemId } = payload;

  const parseId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  };

  const winner = parseId(winnerItemId);
  const loser = parseId(loserItemId);

  if (!winner || !loser || winner === loser) {
    return null;
  }

  return { winnerItemId: winner, loserItemId: loser };
};

type ComparisonResultRow = {
  winner_item_id: number;
  winner_rating: string | number;
  winner_comparison_count: number;
  loser_item_id: number;
  loser_rating: string | number;
  loser_comparison_count: number;
};

const normalizeComparisonResult = (row: ComparisonResultRow | undefined | null) => {
  if (!row) {
    return null;
  }

  return {
    winner: {
      itemId: row.winner_item_id,
      rating: normalizeRating(row.winner_rating),
      comparisonCount: row.winner_comparison_count,
    },
    loser: {
      itemId: row.loser_item_id,
      rating: normalizeRating(row.loser_rating),
      comparisonCount: row.loser_comparison_count,
    },
  } as const;
};

export async function POST(
  request: Request,
  context: { params: { groupId: string } }
): Promise<NextResponse> {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  const { groupId } = context.params;

  if (!groupId || !isValidUuid(groupId)) {
    return NextResponse.json({ error: 'Provide a valid group identifier.' }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsedPayload = parseComparisonBody((payload ?? {}) as ComparisonRequestBody);

  if (!parsedPayload) {
    return NextResponse.json({ error: 'Provide winner and loser movie IDs.' }, { status: 400 });
  }

  const { data: userResult, error: userError } = await supabaseAdminClient.auth.getUser(token);

  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'User session could not be verified.' }, { status: 401 });
  }

  try {
    const userId = userResult.user.id;

    const { data: group, error: groupError } = await supabaseAdminClient
      .from('ranking_groups')
      .select('id, item_type_id')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      throw groupError;
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
    }

    const movieItemTypeId = await getMovieItemTypeId();

    if (group.item_type_id !== movieItemTypeId) {
      return NextResponse.json({ error: 'Only movie groups support matchups right now.' }, { status: 400 });
    }

    const { error: participantError } = await supabaseAdminClient
      .from('group_participants')
      .upsert(
        { group_id: groupId, user_id: userId },
        { onConflict: 'user_id,group_id' }
      );

    if (participantError) {
      throw participantError;
    }

    const { data: groupItems, error: groupItemsError } = await supabaseAdminClient
      .from('group_items')
      .select('item_id')
      .eq('group_id', groupId)
      .in('item_id', [parsedPayload.winnerItemId, parsedPayload.loserItemId]);

    if (groupItemsError) {
      throw groupItemsError;
    }

    if (!groupItems || groupItems.length !== 2) {
      return NextResponse.json({ error: 'Both movies must belong to this group.' }, { status: 400 });
    }

    const { data: comparisonResult, error: comparisonError } = await supabaseAdminClient.rpc(
      'process_group_movie_comparison',
      {
        p_user_id: userId,
        p_group_id: groupId,
        p_winner_item_id: parsedPayload.winnerItemId,
        p_loser_item_id: parsedPayload.loserItemId,
      }
    );

    if (comparisonError) {
      throw comparisonError;
    }

    const normalizedResult = normalizeComparisonResult((comparisonResult ?? [])[0] as ComparisonResultRow | undefined);

    if (!normalizedResult) {
      return NextResponse.json({ error: 'Failed to update movie ratings.' }, { status: 500 });
    }

    return NextResponse.json(normalizedResult);
  } catch (error) {
    console.error('Failed to process comparison result:', error);
    return NextResponse.json({ error: 'Failed to process the comparison result.' }, { status: 500 });
  }
}
