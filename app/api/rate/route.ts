import { NextResponse } from 'next/server';

import { supabaseAdminClient } from '@/lib/supabaseAdminClient';

const BASE_RATING = 1500;

const parseIntegerId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice('bearer '.length).trim();

  return token || null;
};

const selectKFactor = (comparisonCount: number): number => {
  if (comparisonCount <= 10) {
    return 40;
  }

  if (comparisonCount <= 30) {
    return 20;
  }

  return 10;
};

const calculateExpectedScore = (playerRating: number, opponentRating: number): number => {
  const exponent = (opponentRating - playerRating) / 400;
  const denominator = 1 + Math.pow(10, exponent);
  return 1 / denominator;
};

const roundRating = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

type RateRequestPayload = {
  groupId?: unknown;
  winnerId?: unknown;
  loserId?: unknown;
};

type RatingRow = {
  item_id: number;
  rating: number | string;
  comparison_count: number | string | null;
};

type ExistingRating = {
  rating: number;
  comparisonCount: number;
};

export async function POST(request: Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  let payload: RateRequestPayload;

  try {
    payload = (await request.json()) as RateRequestPayload;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const groupId = typeof payload.groupId === 'string' ? payload.groupId : null;
  const winnerId = parseIntegerId(payload.winnerId);
  const loserId = parseIntegerId(payload.loserId);

  if (!groupId || !winnerId || !loserId) {
    return NextResponse.json(
      { error: 'Provide groupId, winnerId, and loserId to record the comparison result.' },
      { status: 400 }
    );
  }

  if (winnerId === loserId) {
    return NextResponse.json({ error: 'winnerId and loserId must reference different items.' }, { status: 400 });
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
      .select('item_id')
      .eq('group_id', groupId)
      .in('item_id', [winnerId, loserId]);

    if (groupItemsError) {
      throw groupItemsError;
    }

    const uniqueItemIds = new Set<number>((groupItems ?? []).map((row) => Number(row.item_id)));

    if (!uniqueItemIds.has(winnerId) || !uniqueItemIds.has(loserId)) {
      return NextResponse.json({ error: 'Both items must belong to the specified ranking group.' }, { status: 400 });
    }

    const { data: ratingRows, error: ratingError } = await supabaseAdminClient
      .from('user_group_item_ratings')
      .select('item_id, rating, comparison_count')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .in('item_id', [winnerId, loserId]);

    if (ratingError) {
      throw ratingError;
    }

    const ratingsByItem = new Map<number, ExistingRating>();

    for (const row of (ratingRows ?? []) as RatingRow[]) {
      const itemId = Number(row.item_id);
      const ratingValue = typeof row.rating === 'number' ? row.rating : Number.parseFloat(String(row.rating));
      const comparisonValue =
        typeof row.comparison_count === 'number'
          ? row.comparison_count
          : Number.parseInt(String(row.comparison_count ?? 0), 10);

      ratingsByItem.set(itemId, {
        rating: Number.isFinite(ratingValue) ? ratingValue : BASE_RATING,
        comparisonCount: Number.isFinite(comparisonValue) ? comparisonValue : 0,
      });
    }

    const winnerExisting = ratingsByItem.get(winnerId) ?? { rating: BASE_RATING, comparisonCount: 0 };
    const loserExisting = ratingsByItem.get(loserId) ?? { rating: BASE_RATING, comparisonCount: 0 };

    const winnerExpected = calculateExpectedScore(winnerExisting.rating, loserExisting.rating);
    const loserExpected = calculateExpectedScore(loserExisting.rating, winnerExisting.rating);

    const winnerK = selectKFactor(winnerExisting.comparisonCount);
    const loserK = selectKFactor(loserExisting.comparisonCount);

    const winnerRating = roundRating(winnerExisting.rating + winnerK * (1 - winnerExpected));
    const loserRating = roundRating(loserExisting.rating + loserK * (0 - loserExpected));

    const winnerComparisonCount = winnerExisting.comparisonCount + 1;
    const loserComparisonCount = loserExisting.comparisonCount + 1;

    const upsertPayload = [
      {
        user_id: userId,
        group_id: groupId,
        item_id: winnerId,
        rating: winnerRating,
        comparison_count: winnerComparisonCount,
      },
      {
        user_id: userId,
        group_id: groupId,
        item_id: loserId,
        rating: loserRating,
        comparison_count: loserComparisonCount,
      },
    ];

    const { error: upsertError } = await supabaseAdminClient
      .from('user_group_item_ratings')
      .upsert(upsertPayload, { onConflict: 'user_id,group_id,item_id' });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({
      groupId,
      winner: {
        itemId: winnerId,
        rating: winnerRating,
        comparisonCount: winnerComparisonCount,
      },
      loser: {
        itemId: loserId,
        rating: loserRating,
        comparisonCount: loserComparisonCount,
      },
    });
  } catch (error) {
    console.error('Failed to update Elo ratings:', error);
    return NextResponse.json({ error: 'Failed to update Elo ratings.' }, { status: 500 });
  }
}
