import { NextResponse } from 'next/server';

import { MOVIE_POSTER_SIZE } from '@/lib/movies';
import { supabaseAdminClient } from '@/lib/supabaseAdminClient';
import { buildPosterUrl, getTmdbConfiguration } from '@/lib/tmdb';

const BASE_RATING = 1500;

type ComparisonCandidate = {
  id: number;
  name: string;
  imagePath: string | null;
  rating: number;
  comparisonCount: number;
};

type MatchupItemResponse = {
  id: number;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
  rating: number;
  comparisonCount: number;
};

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice('bearer '.length).trim();

  return token || null;
};

const selectMatchup = (items: ComparisonCandidate[]): [ComparisonCandidate, ComparisonCandidate] | null => {
  if (items.length < 2) {
    return null;
  }

  const sortedByComparisons = [...items].sort((a, b) => {
    if (a.comparisonCount !== b.comparisonCount) {
      return a.comparisonCount - b.comparisonCount;
    }

    const aBaselineDistance = Math.abs(a.rating - BASE_RATING);
    const bBaselineDistance = Math.abs(b.rating - BASE_RATING);

    return aBaselineDistance - bBaselineDistance;
  });

  const poolSize = Math.min(5, sortedByComparisons.length);
  const candidatePool = sortedByComparisons.slice(0, poolSize);
  const firstIndex = Math.floor(Math.random() * candidatePool.length);
  const firstItem = candidatePool[firstIndex];

  const remainingItems = items.filter((item) => item.id !== firstItem.id);

  if (remainingItems.length === 0) {
    return null;
  }

  let chosenOpponent = remainingItems[0];
  let bestComparisonGap = Math.abs(chosenOpponent.comparisonCount - firstItem.comparisonCount);
  let bestRatingGap = Math.abs(chosenOpponent.rating - firstItem.rating);

  for (const contender of remainingItems.slice(1)) {
    const comparisonGap = Math.abs(contender.comparisonCount - firstItem.comparisonCount);
    const ratingGap = Math.abs(contender.rating - firstItem.rating);

    const isBetterComparison = comparisonGap < bestComparisonGap;
    const isEqualComparison = comparisonGap === bestComparisonGap;
    const improvesRating = ratingGap < bestRatingGap;

    if (isBetterComparison || (isEqualComparison && improvesRating)) {
      chosenOpponent = contender;
      bestComparisonGap = comparisonGap;
      bestRatingGap = ratingGap;
    }
  }

  return [firstItem, chosenOpponent];
};

const normalizePosterUrl = (
  imagePath: string | null,
  tmdbConfig: Awaited<ReturnType<typeof getTmdbConfiguration>> | null
): string | null => {
  if (!imagePath) {
    return null;
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  if (!tmdbConfig) {
    return null;
  }

  return buildPosterUrl(tmdbConfig, imagePath, MOVIE_POSTER_SIZE);
};

export async function GET(request: Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const groupId = url.searchParams.get('groupId');

  if (!groupId) {
    return NextResponse.json({ error: 'A groupId query parameter is required.' }, { status: 400 });
  }

  const { data: userResult, error: userError } = await supabaseAdminClient.auth.getUser(token);

  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'User session could not be verified.' }, { status: 401 });
  }

  const userId = userResult.user.id;

  try {
    const { data: participant, error: participantError } = await supabaseAdminClient
      .from('group_participants')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (!participant) {
      return NextResponse.json({ error: 'You are not a participant in this ranking group.' }, { status: 403 });
    }

    const { data: groupItems, error: groupItemsError } = await supabaseAdminClient
      .from('group_items')
      .select('item_id, rankable_items(id, name, image_path)')
      .eq('group_id', groupId);

    if (groupItemsError) {
      throw groupItemsError;
    }

    const mappedItems: { id: number; name: string; imagePath: string | null }[] = [];

    for (const row of groupItems ?? []) {
      const item = row.rankable_items as { id: number; name: string; image_path: string | null } | null;

      if (!item) {
        continue;
      }

      mappedItems.push({
        id: item.id,
        name: item.name,
        imagePath: item.image_path ?? null,
      });
    }

    if (mappedItems.length < 2) {
      return NextResponse.json(
        { error: 'At least two items are required in the group to run comparisons.' },
        { status: 400 }
      );
    }

    const { data: ratings, error: ratingsError } = await supabaseAdminClient
      .from('user_group_item_ratings')
      .select('item_id, rating, comparison_count')
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (ratingsError) {
      throw ratingsError;
    }

    const ratingMap = new Map<number, { rating: number; comparisonCount: number }>();

    for (const row of ratings ?? []) {
      const itemId = Number(row.item_id);

      if (!Number.isFinite(itemId)) {
        continue;
      }

      const ratingValue = typeof row.rating === 'number' ? row.rating : Number.parseFloat(String(row.rating));
      const comparisonValue = typeof row.comparison_count === 'number'
        ? row.comparison_count
        : Number.parseInt(String(row.comparison_count ?? 0), 10);

      ratingMap.set(itemId, {
        rating: Number.isFinite(ratingValue) ? ratingValue : BASE_RATING,
        comparisonCount: Number.isFinite(comparisonValue) ? comparisonValue : 0,
      });
    }

    const candidates: ComparisonCandidate[] = mappedItems.map((item) => {
      const existing = ratingMap.get(item.id);

      return {
        id: item.id,
        name: item.name,
        imagePath: item.imagePath,
        rating: existing?.rating ?? BASE_RATING,
        comparisonCount: existing?.comparisonCount ?? 0,
      };
    });

    const matchup = selectMatchup(candidates);

    if (!matchup) {
      return NextResponse.json({ error: 'Unable to build a comparison pair.' }, { status: 400 });
    }

    let tmdbConfig: Awaited<ReturnType<typeof getTmdbConfiguration>> | null = null;

    try {
      tmdbConfig = await getTmdbConfiguration();
    } catch (configError) {
      console.warn('TMDb configuration could not be loaded for matchup response:', configError);
      tmdbConfig = null;
    }

    const [itemA, itemB] = matchup;

    const responsePayload = {
      groupId,
      itemA: {
        id: itemA.id,
        name: itemA.name,
        imagePath: itemA.imagePath,
        imageUrl: normalizePosterUrl(itemA.imagePath, tmdbConfig),
        rating: itemA.rating,
        comparisonCount: itemA.comparisonCount,
      } satisfies MatchupItemResponse,
      itemB: {
        id: itemB.id,
        name: itemB.name,
        imagePath: itemB.imagePath,
        imageUrl: normalizePosterUrl(itemB.imagePath, tmdbConfig),
        rating: itemB.rating,
        comparisonCount: itemB.comparisonCount,
      } satisfies MatchupItemResponse,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Failed to fetch comparison matchup:', error);
    return NextResponse.json({ error: 'Failed to load comparison matchup.' }, { status: 500 });
  }
}
