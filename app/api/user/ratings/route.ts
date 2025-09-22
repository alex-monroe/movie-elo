import { NextResponse } from 'next/server';

import { supabaseAdminClient } from '@/lib/supabaseAdminClient';

type RawRankableItem = {
  id?: unknown;
  name?: unknown;
  image_path?: unknown;
};

type RawGroupItemRow = {
  item_id?: unknown;
  rankable_items?: RawRankableItem | RawRankableItem[] | null;
};

type RawRatingRow = {
  item_id?: unknown;
  rating?: unknown;
  comparison_count?: unknown;
};

type UserRatingItem = {
  itemId: number;
  name: string;
  posterPath: string | null;
  rating: number;
  comparisonCount: number;
};

const BASE_RATING = 1500;

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice('bearer '.length).trim();

  return token || null;
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
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

const parseRankableItem = (value: RawRankableItem | null | undefined): {
  id: number;
  name: string;
  imagePath: string | null;
} | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const { id, name, image_path: imagePath } = value;

  const normalizedId = parseInteger(id);

  if (normalizedId === null) {
    return null;
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  const normalizedImagePath =
    typeof imagePath === 'string' && imagePath.trim().length > 0 ? imagePath.trim() : null;

  return {
    id: normalizedId,
    name: name.trim(),
    imagePath: normalizedImagePath,
  };
};

const parseGroupItemRow = (value: RawGroupItemRow): {
  itemId: number;
  name: string;
  imagePath: string | null;
} | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const normalizedItemId = parseInteger(value.item_id);
  const rawItem = Array.isArray(value.rankable_items)
    ? value.rankable_items.at(0)
    : value.rankable_items;

  const parsedItem = parseRankableItem(rawItem ?? null);

  if (!parsedItem) {
    return null;
  }

  return {
    itemId: normalizedItemId ?? parsedItem.id,
    name: parsedItem.name,
    imagePath: parsedItem.imagePath,
  };
};

const parseRatingRow = (value: RawRatingRow): {
  itemId: number;
  rating: number;
  comparisonCount: number;
} | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const itemId = parseInteger(value.item_id);

  if (itemId === null) {
    return null;
  }

  const ratingValue =
    typeof value.rating === 'number'
      ? value.rating
      : Number.parseFloat(String(value.rating ?? ''));

  const comparisonValue =
    typeof value.comparison_count === 'number'
      ? value.comparison_count
      : Number.parseInt(String(value.comparison_count ?? '0'), 10);

  return {
    itemId,
    rating: Number.isFinite(ratingValue) ? ratingValue : BASE_RATING,
    comparisonCount: Number.isFinite(comparisonValue) ? comparisonValue : 0,
  };
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

    const normalizedItems = [] as {
      itemId: number;
      name: string;
      imagePath: string | null;
    }[];

    for (const row of (groupItems ?? []) as RawGroupItemRow[]) {
      const parsed = parseGroupItemRow(row);

      if (parsed) {
        normalizedItems.push(parsed);
      }
    }

    if (normalizedItems.length === 0) {
      return NextResponse.json({ groupId, items: [] });
    }

    const { data: ratingRows, error: ratingsError } = await supabaseAdminClient
      .from('user_group_item_ratings')
      .select('item_id, rating, comparison_count')
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (ratingsError) {
      throw ratingsError;
    }

    const ratingMap = new Map<number, { rating: number; comparisonCount: number }>();

    for (const row of (ratingRows ?? []) as RawRatingRow[]) {
      const parsed = parseRatingRow(row);

      if (parsed) {
        ratingMap.set(parsed.itemId, {
          rating: parsed.rating,
          comparisonCount: parsed.comparisonCount,
        });
      }
    }

    const responseItems: UserRatingItem[] = normalizedItems.map((item) => {
      const existing = ratingMap.get(item.itemId);

      return {
        itemId: item.itemId,
        name: item.name,
        posterPath: item.imagePath,
        rating: existing?.rating ?? BASE_RATING,
        comparisonCount: existing?.comparisonCount ?? 0,
      } satisfies UserRatingItem;
    });

    responseItems.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      if (b.comparisonCount !== a.comparisonCount) {
        return b.comparisonCount - a.comparisonCount;
      }

      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ groupId, items: responseItems });
  } catch (error) {
    console.error('Failed to load user ratings:', error);
    return NextResponse.json({ error: 'Failed to load user ratings.' }, { status: 500 });
  }
}
