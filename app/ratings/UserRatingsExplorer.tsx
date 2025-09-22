'use client';

import { useEffect, useMemo, useState } from 'react';

import MoviePoster from '@/app/components/MoviePoster';
import { MOVIE_POSTER_SIZE } from '@/lib/movies';
import { supabase } from '@/lib/supabaseClient';
import { buildPosterUrl, type TmdbConfigurationResponse } from '@/lib/tmdb';

type GroupOption = {
  id: string;
  name: string;
  description: string | null;
};

type RatingItem = {
  itemId: number;
  name: string;
  posterPath: string | null;
  rating: number;
  comparisonCount: number;
};

type GroupsResponsePayload = {
  groups?: unknown;
  error?: unknown;
};

type RatingsResponsePayload = {
  items?: unknown;
  error?: unknown;
};

const BASE_RATING = 1500;

const parseErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
};

const parseGroupsResponse = (payload: unknown): GroupOption[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const groupsValue = (payload as GroupsResponsePayload).groups;

  if (!Array.isArray(groupsValue)) {
    return [];
  }

  const normalized: GroupOption[] = [];

  for (const entry of groupsValue) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const { id, name, description } = entry as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
    };

    if (typeof id !== 'string' || id.trim().length === 0) {
      continue;
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      continue;
    }

    normalized.push({
      id: id.trim(),
      name: name.trim(),
      description: typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
    });
  }

  return normalized;
};

const parseRatingsResponse = (payload: unknown): RatingItem[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const itemsValue = (payload as RatingsResponsePayload).items;

  if (!Array.isArray(itemsValue)) {
    return [];
  }

  const normalized: RatingItem[] = [];

  for (const entry of itemsValue) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const { itemId, name, posterPath, rating, comparisonCount } = entry as {
      itemId?: unknown;
      name?: unknown;
      posterPath?: unknown;
      rating?: unknown;
      comparisonCount?: unknown;
    };

    let normalizedId: number | null = null;

    if (typeof itemId === 'number' && Number.isFinite(itemId)) {
      normalizedId = Math.trunc(itemId);
    } else if (typeof itemId === 'string') {
      const parsed = Number.parseInt(itemId, 10);
      if (Number.isFinite(parsed)) {
        normalizedId = parsed;
      }
    }

    if (normalizedId === null) {
      continue;
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      continue;
    }

    const parsedRating =
      typeof rating === 'number'
        ? rating
        : Number.parseFloat(typeof rating === 'string' ? rating : String(rating ?? ''));

    const parsedComparisons =
      typeof comparisonCount === 'number'
        ? comparisonCount
        : Number.parseInt(typeof comparisonCount === 'string' ? comparisonCount : String(comparisonCount ?? '0'), 10);

    normalized.push({
      itemId: normalizedId,
      name: name.trim(),
      posterPath:
        typeof posterPath === 'string' && posterPath.trim().length > 0 ? posterPath.trim() : null,
      rating: Number.isFinite(parsedRating) ? parsedRating : BASE_RATING,
      comparisonCount: Number.isFinite(parsedComparisons) ? parsedComparisons : 0,
    });
  }

  return normalized;
};

const formatRating = (value: number): string => {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatComparisonLabel = (value: number): string => {
  if (value === 1) {
    return '1 comparison logged';
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} comparisons logged`;
};

const resolvePosterUrl = (
  posterPath: string | null,
  tmdbConfig: TmdbConfigurationResponse | null
): string | null => {
  if (!posterPath) {
    return null;
  }

  if (posterPath.startsWith('http://') || posterPath.startsWith('https://')) {
    return posterPath;
  }

  if (!tmdbConfig) {
    return null;
  }

  return buildPosterUrl(tmdbConfig, posterPath, MOVIE_POSTER_SIZE);
};

type UserRatingsExplorerProps = {
  tmdbConfig: TmdbConfigurationResponse | null;
};

const UserRatingsExplorer = ({ tmdbConfig }: UserRatingsExplorerProps) => {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setAccessToken(data.session?.access_token ?? null);
      } catch (error) {
        console.warn('Failed to load Supabase session:', error);
        if (isMounted) {
          setAccessToken(null);
        }
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setAccessToken(session?.access_token ?? null);
      setSessionChecked(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked) {
      return;
    }

    if (!accessToken) {
      setGroups([]);
      setSelectedGroupId(null);
      setGroupsError(null);
      return;
    }

    let isActive = true;

    const loadGroups = async () => {
      setLoadingGroups(true);
      setGroupsError(null);

      try {
        const response = await fetch('/api/user/groups', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = await response.json().catch(() => null);

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          const message = parseErrorMessage(payload, 'Failed to load your ranking groups.');
          setGroupsError(message);
          setGroups([]);
          setSelectedGroupId(null);
          return;
        }

        const normalized = parseGroupsResponse(payload);
        setGroups(normalized);

        setSelectedGroupId((previous) => {
          if (previous && normalized.some((group) => group.id === previous)) {
            return previous;
          }

          return normalized.at(0)?.id ?? null;
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load ranking groups:', error);
        setGroupsError('Failed to load your ranking groups.');
        setGroups([]);
        setSelectedGroupId(null);
      } finally {
        if (isActive) {
          setLoadingGroups(false);
        }
      }
    };

    void loadGroups();

    return () => {
      isActive = false;
    };
  }, [accessToken, sessionChecked]);

  useEffect(() => {
    if (!accessToken || !selectedGroupId) {
      setRatings([]);
      setRatingsError(null);
      return;
    }

    let isActive = true;

    const loadRatings = async () => {
      setRatingsLoading(true);
      setRatingsError(null);

      try {
        const response = await fetch(`/api/user/ratings?groupId=${encodeURIComponent(selectedGroupId)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = await response.json().catch(() => null);

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          const message = parseErrorMessage(payload, 'Failed to load your movie ratings.');
          setRatingsError(message);
          setRatings([]);
          return;
        }

        const normalized = parseRatingsResponse(payload);
        setRatings(normalized);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load user ratings:', error);
        setRatingsError('Failed to load your movie ratings.');
        setRatings([]);
      } finally {
        if (isActive) {
          setRatingsLoading(false);
        }
      }
    };

    void loadRatings();

    return () => {
      isActive = false;
    };
  }, [accessToken, selectedGroupId]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }

    return groups.find((group) => group.id === selectedGroupId) ?? null;
  }, [groups, selectedGroupId]);

  const hasAnyComparisons = useMemo(() => {
    return ratings.some((item) => item.comparisonCount > 0);
  }, [ratings]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-white">Choose a ranking group</h2>
          <p className="text-sm text-gray-300">
            Pick a group to inspect the Elo ratings you&apos;ve built through head-to-head matchups.
          </p>
        </div>

        {!sessionChecked ? (
          <p className="mt-4 text-sm text-gray-400">Checking your session…</p>
        ) : !accessToken ? (
          <p className="mt-4 text-sm text-gray-400">Sign in to view your personal ratings.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {groupsError ? (
              <div className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {groupsError}
              </div>
            ) : null}

            {loadingGroups ? (
              <p className="text-sm text-gray-400">Loading your groups…</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-gray-400">
                You&apos;re not part of any ranking groups yet. Create one or ask a friend to invite you.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                <label htmlFor="group-select" className="text-sm font-medium text-gray-200">
                  Ranking group
                </label>
                <select
                  id="group-select"
                  value={selectedGroupId ?? ''}
                  onChange={(event) => setSelectedGroupId(event.target.value || null)}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-80"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedGroup ? (
              <p className="text-sm text-gray-400">
                {selectedGroup.description ?? 'No description provided for this group yet.'}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-white">Movie ratings</h2>
          <p className="text-sm text-gray-300">Movies are sorted from the highest Elo rating to the lowest.</p>
        </div>

        {!sessionChecked ? (
          <p className="mt-4 text-sm text-gray-400">Checking your session…</p>
        ) : !accessToken ? (
          <p className="mt-4 text-sm text-gray-400">Sign in to review your ratings.</p>
        ) : !selectedGroupId ? (
          <p className="mt-4 text-sm text-gray-400">Choose a group above to view your movie list.</p>
        ) : ratingsError ? (
          <div className="mt-4 rounded-md border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {ratingsError}
          </div>
        ) : ratingsLoading ? (
          <p className="mt-4 text-sm text-gray-400">Loading your ratings…</p>
        ) : ratings.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">This group doesn&apos;t have any movies yet.</p>
        ) : (
          <>
            {!hasAnyComparisons ? (
              <p className="mt-4 text-sm text-amber-200">
                You haven&apos;t compared any movies in this group yet. All films are still at the starting Elo rating of{' '}
                {formatRating(BASE_RATING)}.
              </p>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                New movies join at {formatRating(BASE_RATING)} Elo until you record matchups.
              </p>
            )}

            <ol className="mt-6 space-y-4">
              {ratings.map((item, index) => {
                const posterUrl = resolvePosterUrl(item.posterPath, tmdbConfig);

                return (
                  <li
                    key={item.itemId}
                    className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900/60 p-4 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-semibold text-blue-300 sm:text-2xl">#{index + 1}</span>
                      <MoviePoster
                        posterUrl={posterUrl}
                        title={item.name}
                        imageClassName="h-auto w-20 rounded-md object-cover shadow-md shadow-black/40 sm:w-24"
                        placeholderClassName="flex h-32 w-20 items-center justify-center rounded-md bg-gray-800 text-xs text-gray-400 sm:w-24"
                        sizes="96px"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="text-lg font-semibold text-white sm:text-xl">{item.name}</h3>
                        <span className="text-sm font-mono text-blue-300 sm:text-base">
                          {formatRating(item.rating)} Elo
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{formatComparisonLabel(item.comparisonCount)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
};

export default UserRatingsExplorer;
