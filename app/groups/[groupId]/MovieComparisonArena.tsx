'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MoviePoster from '@/app/components/MoviePoster';
import { parseMovieReleaseYear, MOVIE_POSTER_SIZE } from '@/lib/movieMetadata';
import { supabase } from '@/lib/supabaseClient';
import { buildPosterUrl, type TmdbConfigurationResponse } from '@/lib/tmdb';

type MatchItem = {
  itemId: number;
  name: string;
  imagePath: string | null;
  metadata: Record<string, unknown> | null;
  rating: number;
  comparisonCount: number;
};

type MatchupResponse = {
  matchup?: MatchItem[];
  error?: string;
};

type ComparisonResultResponse = {
  winner?: {
    itemId: number;
    rating: number;
    comparisonCount: number;
  };
  loser?: {
    itemId: number;
    rating: number;
    comparisonCount: number;
  };
  error?: string;
};

type MatchupMovie = MatchItem & {
  posterUrl: string | null;
  releaseYear: string | null;
};

type ResultSummary = {
  winner: {
    name: string;
    ratingBefore: number;
    ratingAfter: number;
    comparisonsAfter: number;
  };
  loser: {
    name: string;
    ratingBefore: number;
    ratingAfter: number;
    comparisonsAfter: number;
  };
};

type MovieComparisonArenaProps = {
  groupId: string;
  groupName: string;
  movieCount: number;
  tmdbConfig: TmdbConfigurationResponse;
};

const formatRating = (value: number) => value.toFixed(1);

const formatDelta = (value: number) => {
  const rounded = value.toFixed(1);
  return value >= 0 ? `+${rounded}` : rounded;
};

const MovieComparisonArena = ({ groupId, groupName, movieCount, tmdbConfig }: MovieComparisonArenaProps) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingMatchup, setLoadingMatchup] = useState(false);
  const [matchup, setMatchup] = useState<MatchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!active || !isMountedRef.current) {
        return;
      }

      setAccessToken(data.session?.access_token ?? null);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) {
        return;
      }

      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setResultSummary(null);
      setError(null);
    }
  }, [accessToken]);

  const fetchNextMatchup = useCallback(
    async (token: string) => {
      setLoadingMatchup(true);
      setError(null);

      try {
        const response = await fetch(`/api/groups/${groupId}/match`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const payload = (await response.json()) as MatchupResponse;

        if (!isMountedRef.current) {
          return;
        }

        if (!response.ok) {
          setMatchup(null);
          setError(payload.error ?? 'Failed to load the next matchup.');
          return;
        }

        const movies = payload.matchup ?? [];

        if (movies.length !== 2) {
          setMatchup(null);
          setError('Not enough movies are available to create a matchup.');
          return;
        }

        setMatchup(movies);
      } catch (requestError) {
        if (!isMountedRef.current) {
          return;
        }

        const message =
          requestError instanceof Error ? requestError.message : 'Unexpected error while loading the matchup.';
        setError(message);
        setMatchup(null);
      } finally {
        if (isMountedRef.current) {
          setLoadingMatchup(false);
        }
      }
    },
    [groupId]
  );

  useEffect(() => {
    if (!accessToken || movieCount < 2) {
      setMatchup(null);
      return;
    }

    fetchNextMatchup(accessToken);
  }, [accessToken, fetchNextMatchup, movieCount]);

  const derivedMatchup = useMemo<MatchupMovie[] | null>(() => {
    if (!matchup) {
      return null;
    }

    return matchup.map((movie) => ({
      ...movie,
      posterUrl: buildPosterUrl(tmdbConfig, movie.imagePath, MOVIE_POSTER_SIZE),
      releaseYear: parseMovieReleaseYear(movie.metadata),
    }));
  }, [matchup, tmdbConfig]);

  const handleVote = async (winner: MatchItem, loser: MatchItem) => {
    if (!accessToken || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ winnerItemId: winner.itemId, loserItemId: loser.itemId }),
      });

      const payload = (await response.json()) as ComparisonResultResponse;

      if (!isMountedRef.current) {
        return;
      }

      if (!response.ok || !payload.winner || !payload.loser) {
        setError(payload.error ?? 'Failed to record your comparison.');
        return;
      }

      setResultSummary({
        winner: {
          name: winner.name,
          ratingBefore: winner.rating,
          ratingAfter: payload.winner.rating,
          comparisonsAfter: payload.winner.comparisonCount,
        },
        loser: {
          name: loser.name,
          ratingBefore: loser.rating,
          ratingAfter: payload.loser.rating,
          comparisonsAfter: payload.loser.comparisonCount,
        },
      });

      await fetchNextMatchup(accessToken);
    } catch (submissionError) {
      if (!isMountedRef.current) {
        return;
      }

      const message =
        submissionError instanceof Error
          ? submissionError.message
          : 'Unexpected error while submitting the comparison.';
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const isAuthenticated = Boolean(accessToken);
  const showMatchup = Boolean(derivedMatchup) && !loadingMatchup && !error;

  return (
    <section className="mb-16 rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h2 className="text-2xl font-semibold text-white">Rank movies in {groupName}</h2>
          <p className="text-sm text-gray-300">
            Choose the movie that you prefer in each matchup to update your Elo ratings. Ratings start at 1200 and stabilize as
            you make more comparisons.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Sign in from the homepage to begin ranking these movies. Your comparisons will be saved to your account.
          </div>
        ) : null}

        {movieCount < 2 ? (
          <div className="rounded-md border border-blue-500/60 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            Add at least two movies to this group to start ranking. You currently have {movieCount}{' '}
            {movieCount === 1 ? 'movie' : 'movies'} configured.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        {resultSummary ? (
          <div className="rounded-md border border-green-500/60 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            <p className="font-semibold">Comparison recorded!</p>
            <p className="mt-1">
              <span className="font-semibold text-white">{resultSummary.winner.name}</span> moved from{' '}
              {formatRating(resultSummary.winner.ratingBefore)} to {formatRating(resultSummary.winner.ratingAfter)} (
              {formatDelta(resultSummary.winner.ratingAfter - resultSummary.winner.ratingBefore)}). It has now appeared in{' '}
              {resultSummary.winner.comparisonsAfter} comparisons.
            </p>
            <p className="mt-1">
              <span className="font-semibold text-white">{resultSummary.loser.name}</span> shifted to{' '}
              {formatRating(resultSummary.loser.ratingAfter)} ({formatDelta(
                resultSummary.loser.ratingAfter - resultSummary.loser.ratingBefore
              )}).
            </p>
          </div>
        ) : null}

        <div className="mt-4">
          {showMatchup ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {derivedMatchup!.map((movie, index) => {
                const opponent = derivedMatchup![index === 0 ? 1 : 0];

                return (
                  <button
                    key={movie.itemId}
                    type="button"
                    onClick={() => handleVote(matchup![index], matchup![index === 0 ? 1 : 0])}
                    disabled={!isAuthenticated || submitting || loadingMatchup}
                    className="group flex h-full flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900/80 p-4 text-left transition hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex justify-center">
                      <MoviePoster posterUrl={movie.posterUrl} title={movie.name} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xl font-semibold text-white">{movie.name}</p>
                        <p className="text-sm text-gray-400">
                          {movie.releaseYear ? `Released ${movie.releaseYear}` : 'Release year unknown'}
                        </p>
                      </div>
                      <div className="rounded-md bg-gray-950/80 px-3 py-2 text-sm text-gray-300">
                        <p>
                          Current rating: <span className="font-semibold text-white">{formatRating(movie.rating)}</span>
                        </p>
                        <p>
                          Comparisons logged:{' '}
                          <span className="font-semibold text-white">{movie.comparisonCount}</span>
                        </p>
                      </div>
                      <p className="text-sm text-gray-300">
                        Prefer <span className="font-semibold text-white">{movie.name}</span> over{' '}
                        <span className="font-semibold text-white">{opponent.name}</span>
                      </p>
                      <span className="inline-flex items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-blue-400">
                        Choose {movie.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center text-sm text-gray-300">
              {loadingMatchup
                ? 'Looking for your next matchup…'
                : isAuthenticated
                  ? 'Once a matchup is ready it will appear here. Add more movies if you run out of comparisons.'
                  : 'Sign in to start ranking these movies.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MovieComparisonArena;
