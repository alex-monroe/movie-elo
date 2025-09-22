import { NextResponse } from 'next/server';

import { getMovieItemTypeId } from '@/lib/itemTypes';
import { supabaseAdminClient } from '@/lib/supabaseAdminClient';

type CreateGroupRequestBody = {
  name?: unknown;
  description?: unknown;
  movieIds?: unknown;
};

const parseMovieIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<number>();

  for (const entry of value) {
    let normalized: number | null = null;

    if (typeof entry === 'number' && Number.isFinite(entry)) {
      normalized = Math.trunc(entry);
    } else if (typeof entry === 'string' && entry.trim() !== '') {
      const parsed = Number.parseInt(entry, 10);
      if (Number.isFinite(parsed)) {
        normalized = parsed;
      }
    }

    if (normalized && normalized > 0) {
      uniqueIds.add(normalized);
    }
  }

  return Array.from(uniqueIds);
};

const extractBody = (payload: unknown): { name: string; description: string | null; movieIds: number[] } | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const { name, description, movieIds } = payload as CreateGroupRequestBody;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  const normalizedDescription =
    typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;

  const normalizedMovieIds = parseMovieIds(movieIds);

  return {
    name: name.trim(),
    description: normalizedDescription,
    movieIds: normalizedMovieIds,
  };
};

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  const token = authorization.slice('bearer '.length).trim();

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const body = extractBody(payload);

  if (!body) {
    return NextResponse.json(
      { error: 'Provide a group name, optional description, and at least two movie IDs.' },
      { status: 400 }
    );
  }

  if (body.movieIds.length < 2) {
    return NextResponse.json(
      { error: 'Select at least two movies to build a ranking group.' },
      { status: 400 }
    );
  }

  const { data: userResult, error: userError } = await supabaseAdminClient.auth.getUser(token);

  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'User session could not be verified.' }, { status: 401 });
  }

  const userId = userResult.user.id;

  try {
    const movieItemTypeId = await getMovieItemTypeId();

    const { data: validMovies, error: validationError } = await supabaseAdminClient
      .from('rankable_items')
      .select('id')
      .eq('item_type_id', movieItemTypeId)
      .in('id', body.movieIds);

    if (validationError) {
      throw validationError;
    }

    if (!validMovies || validMovies.length !== body.movieIds.length) {
      return NextResponse.json(
        { error: 'One or more selected movies could not be found.' },
        { status: 400 }
      );
    }

    const { data: insertedGroup, error: insertError } = await supabaseAdminClient
      .from('ranking_groups')
      .insert({
        name: body.name,
        description: body.description,
        creator_id: userId,
        item_type_id: movieItemTypeId,
      })
      .select('id')
      .single();

    if (insertError || !insertedGroup) {
      throw insertError ?? new Error('Group insert failed without an error message.');
    }

    const groupId = insertedGroup.id as string;

    const groupItemsPayload = body.movieIds.map((itemId) => ({
      group_id: groupId,
      item_id: itemId,
    }));

    const { error: groupItemsError } = await supabaseAdminClient
      .from('group_items')
      .insert(groupItemsPayload);

    if (groupItemsError) {
      await supabaseAdminClient.from('ranking_groups').delete().eq('id', groupId);
      throw groupItemsError;
    }

    const { error: participantError } = await supabaseAdminClient
      .from('group_participants')
      .upsert(
        { group_id: groupId, user_id: userId },
        { onConflict: 'user_id,group_id' }
      );

    if (participantError) {
      await supabaseAdminClient.from('group_items').delete().eq('group_id', groupId);
      await supabaseAdminClient.from('ranking_groups').delete().eq('id', groupId);
      throw participantError;
    }

    return NextResponse.json({ groupId, movieCount: body.movieIds.length }, { status: 201 });
  } catch (error) {
    console.error('Failed to create ranking group:', error);
    return NextResponse.json({ error: 'Failed to create ranking group.' }, { status: 500 });
  }
}
