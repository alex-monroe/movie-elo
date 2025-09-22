'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type MatchupItem = {
  id: number;
  name: string;
  imagePath: string | null;
  imageUrl: string | null;
  rating: number;
  comparisonCount: number;
};

type MatchupResponse = {
  groupId: string;
  itemA: MatchupItem;
  itemB: MatchupItem;
};

type ErrorResponse = {
  error?: unknown;
};

type ComparisonPageProps = {
  groupId: string;
};

type ComparisonOptionProps = {
  item: MatchupItem;
  disabled: boolean;
  onSelect: () => void;
};

const parseErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as ErrorResponse).error;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
};

const ComparisonOption = ({ item, disabled, onSelect }: ComparisonOptionProps) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group flex h-full w-full flex-col items-center gap-6 rounded-xl border border-gray-800 bg-gray-950/60 p-6 text-left transition hover:border-blue-500 hover:bg-gray-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 sm:p-8 ${
        disabled ? 'cursor-not-allowed opacity-70 hover:border-gray-800 hover:bg-gray-950/60' : 'cursor-pointer'
      }`}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={`${item.name} artwork`}
          width={342}
          height={513}
          className="h-auto w-48 rounded-lg object-cover shadow-lg shadow-black/50 transition group-hover:scale-[1.02] sm:w-60"
          sizes="(max-width: 640px) 12rem, (max-width: 1024px) 15rem, 20rem"
        />
      ) : (
        <div className="flex h-72 w-48 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900 text-sm text-gray-400 sm:w-60">
          Artwork unavailable
        </div>
      )}
      <div className="w-full text-center">
        <p className="text-lg font-semibold text-white sm:text-xl">{item.name}</p>
      </div>
    </button>
  );
};

const ComparisonPage = ({ groupId }: ComparisonPageProps) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [matchup, setMatchup] = useState<{ itemA: MatchupItem; itemB: MatchupItem } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatchup = useCallback(
    async (token: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/matchup?groupId=${encodeURIComponent(groupId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message = parseErrorMessage(payload, 'Failed to load the next matchup.');
          setMatchup(null);
          setError(message);
          return false;
        }

        const matchupPayload = payload as MatchupResponse | null;

        if (!matchupPayload?.itemA || !matchupPayload?.itemB) {
          setMatchup(null);
          setError('Matchup response was missing items to compare.');
          return false;
        }

        setMatchup({ itemA: matchupPayload.itemA, itemB: matchupPayload.itemB });
        return true;
      } catch (fetchError) {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unexpected error while loading the next matchup.';
        setMatchup(null);
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setAccessToken(data.session?.access_token ?? null);
        setSessionChecked(true);
      } catch (sessionError) {
        if (!isMounted) {
          return;
        }

        console.warn('Failed to load Supabase session:', sessionError);
        setAccessToken(null);
        setSessionChecked(true);
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
    if (!accessToken) {
      setMatchup(null);
      setLoading(false);
      setError(null);
      return;
    }

    void fetchMatchup(accessToken);
  }, [accessToken, fetchMatchup]);

  const handleChoice = useCallback(
    async (winnerId: number, loserId: number) => {
      if (!accessToken || loading) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/rate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ groupId, winnerId, loserId }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = parseErrorMessage(payload, 'Failed to submit your comparison.');
          setError(message);
          setLoading(false);
          return;
        }

        await fetchMatchup(accessToken);
      } catch (submissionError) {
        const message =
          submissionError instanceof Error
            ? submissionError.message
            : 'Unexpected error while submitting the comparison.';
        setError(message);
        setLoading(false);
      }
    },
    [accessToken, fetchMatchup, groupId, loading]
  );

  const handleRetry = useCallback(() => {
    if (!accessToken || loading) {
      return;
    }

    void fetchMatchup(accessToken);
  }, [accessToken, fetchMatchup, loading]);

  const helperText = useMemo(() => {
    if (!sessionChecked) {
      return 'Checking your session...';
    }

    if (!accessToken) {
      return 'Sign in to start comparing items in this group.';
    }

    if (loading) {
      return 'Loading the next matchup...';
    }

    if (!matchup) {
      return 'No matchup is available yet. Try again after adding more items to the group.';
    }

    return 'Tap the item you prefer to update your ranking.';
  }, [accessToken, loading, matchup, sessionChecked]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-8 px-6 py-10 text-white sm:py-12 lg:px-8">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Which option do you prefer?</h1>
        <p className="mt-2 text-sm text-gray-300 sm:text-base">{helperText}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          {accessToken && (
            <button
              type="button"
              onClick={handleRetry}
              className="ml-4 inline-flex items-center gap-2 rounded-md border border-red-400/40 px-3 py-1 text-xs font-medium text-red-100 transition hover:border-red-300 hover:text-white"
              disabled={loading}
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div className="grid flex-1 gap-6 sm:gap-8 md:grid-cols-2">
        {matchup?.itemA ? (
          <ComparisonOption
            item={matchup.itemA}
            disabled={loading || !accessToken}
            onSelect={() => handleChoice(matchup.itemA.id, matchup.itemB.id)}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-950/40 p-6 text-sm text-gray-400">
            {loading ? 'Preparing matchup…' : 'Waiting for matchup data.'}
          </div>
        )}
        {matchup?.itemB ? (
          <ComparisonOption
            item={matchup.itemB}
            disabled={loading || !accessToken}
            onSelect={() => handleChoice(matchup.itemB.id, matchup.itemA.id)}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-950/40 p-6 text-sm text-gray-400">
            {loading ? 'Preparing matchup…' : 'Waiting for matchup data.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonPage;
