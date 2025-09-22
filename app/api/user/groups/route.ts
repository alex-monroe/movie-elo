import { NextResponse } from 'next/server';

import { getMovieItemTypeId } from '@/lib/itemTypes';
import { supabaseAdminClient } from '@/lib/supabaseAdminClient';

type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
};

type ParticipantRow = {
  group_id?: unknown;
};

type GroupRow = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
};

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice('bearer '.length).trim();

  return token || null;
};

const normalizeGroupRow = (value: GroupRow): GroupSummary | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const { id, name, description } = value;

  if (typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  return {
    id: id.trim(),
    name: name.trim(),
    description: typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
  };
};

const extractParticipantGroupIds = (rows: ParticipantRow[]): string[] => {
  const uniqueIds = new Set<string>();

  for (const row of rows) {
    const identifier = row?.group_id;

    if (typeof identifier === 'string' && identifier.trim().length > 0) {
      uniqueIds.add(identifier.trim());
      continue;
    }

    if (typeof identifier === 'number' && Number.isFinite(identifier)) {
      uniqueIds.add(String(identifier));
    }
  }

  return Array.from(uniqueIds);
};

export async function GET(request: Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Authorization token is required.' }, { status: 401 });
  }

  const { data: userResult, error: userError } = await supabaseAdminClient.auth.getUser(token);

  if (userError || !userResult?.user) {
    return NextResponse.json({ error: 'User session could not be verified.' }, { status: 401 });
  }

  const userId = userResult.user.id;

  try {
    const { data: participantRows, error: participantError } = await supabaseAdminClient
      .from('group_participants')
      .select('group_id')
      .eq('user_id', userId);

    if (participantError) {
      throw participantError;
    }

    const groupIds = extractParticipantGroupIds((participantRows ?? []) as ParticipantRow[]);

    if (groupIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const movieItemTypeId = await getMovieItemTypeId();

    const { data: groupRows, error: groupsError } = await supabaseAdminClient
      .from('ranking_groups')
      .select('id, name, description')
      .in('id', groupIds)
      .eq('item_type_id', movieItemTypeId)
      .order('name', { ascending: true });

    if (groupsError) {
      throw groupsError;
    }

    const normalizedGroups: GroupSummary[] = [];

    for (const row of (groupRows ?? []) as GroupRow[]) {
      const normalized = normalizeGroupRow(row);

      if (normalized) {
        normalizedGroups.push(normalized);
      }
    }

    return NextResponse.json({ groups: normalizedGroups });
  } catch (error) {
    console.error('Failed to load user ranking groups:', error);
    return NextResponse.json({ error: 'Failed to load user ranking groups.' }, { status: 500 });
  }
}
