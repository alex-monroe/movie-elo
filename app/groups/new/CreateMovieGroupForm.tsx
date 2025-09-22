'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import MoviePoster from '@/app/components/MoviePoster';
import { supabase } from '@/lib/supabaseClient';

type MovieOption = {
  id: number;
  name: string;
  posterUrl: string | null;
  releaseYear: string | null;
};

type CreateMovieGroupFormProps = {
  movies: MovieOption[];
};

type CreateGroupResponse = {
  groupId?: string;
  movieCount?: number;
  error?: string;
};

const MIN_MOVIE_SELECTION = 2;

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const CreateMovieGroupForm = ({ movies }: CreateMovieGroupFormProps) => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMovies, setSelectedMovies] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const toggleMovieSelection = (movieId: number) => {
    setSelectedMovies((prev) => {
      const next = new Set(prev);

      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }

      return next;
    });
  };

  const filteredMovies = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    if (!normalizedSearch) {
      return movies;
    }

    return movies.filter((movie) => normalizeSearch(movie.name).includes(normalizedSearch));
  }, [movies, searchTerm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setSuccessMessage(null);

    if (!accessToken) {
      setError('You must be signed in to create a ranking group.');
      return;
    }

    if (!groupName.trim()) {
      setError('Enter a name for your ranking group.');
      return;
    }

    if (selectedMovies.size < MIN_MOVIE_SELECTION) {
      setError(`Choose at least ${MIN_MOVIE_SELECTION} movies to get started.`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          movieIds: Array.from(selectedMovies),
        }),
      });

      const payload = (await response.json()) as CreateGroupResponse;

      if (!response.ok) {
        setError(payload.error ?? 'Failed to create ranking group.');
        return;
      }

      const createdMovieCount = payload.movieCount ?? selectedMovies.size;

      setSuccessMessage(
        `Group created successfully with ${createdMovieCount} movie${createdMovieCount === 1 ? '' : 's'}. ` +
          `Share the ID (${payload.groupId}) to invite friends or visit the groups page to start ranking.`
      );
      setGroupName('');
      setGroupDescription('');
      setSelectedMovies(new Set());
      setSearchTerm('');
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Unexpected error while creating the group.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selectedMovies.size;
  const isAuthenticated = Boolean(accessToken);

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-10">
      <section className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30">
        <h2 className="text-2xl font-semibold text-white">Group details</h2>
        <p className="mt-2 text-sm text-gray-300">
          Give your group a descriptive name and optional summary to help participants understand what you&apos;re ranking.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="group-name" className="text-sm font-medium text-gray-200">
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="90s Sci-Fi Classics"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <label htmlFor="group-description" className="text-sm font-medium text-gray-200">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="group-description"
              value={groupDescription}
              onChange={(event) => setGroupDescription(event.target.value)}
              placeholder="Rank the science fiction movies from the 1990s that defined the genre for you."
              rows={4}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Pick the movies to rank</h2>
            <p className="mt-2 text-sm text-gray-300">
              Tap a movie to toggle it in your group. You need at least {MIN_MOVIE_SELECTION} movies to begin ranking.
            </p>
            {!isAuthenticated && (
              <p className="mt-2 text-sm text-amber-300">
                You&apos;ll need to sign in before you can create a group.
              </p>
            )}
          </div>
          {movies.length > 0 && (
            <div className="w-full sm:w-64">
              <label htmlFor="movie-search" className="block text-sm font-medium text-gray-200">
                Search movies
              </label>
              <input
                id="movie-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title"
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-300">
          Selected movies: <span className="font-semibold text-white">{selectedCount}</span>
        </p>

        {movies.length === 0 ? (
          <p className="mt-6 text-sm text-gray-300">
            Upload some movies first to build your library. Once they&apos;re available, you can add them to ranking groups here.
          </p>
        ) : filteredMovies.length === 0 ? (
          <p className="mt-6 text-sm text-gray-300">No movies match your search. Try a different title.</p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMovies.map((movie) => {
              const isSelected = selectedMovies.has(movie.id);

              return (
                <li key={movie.id}>
                  <button
                    type="button"
                    onClick={() => toggleMovieSelection(movie.id)}
                    className={`relative flex h-full w-full flex-col rounded-lg border bg-gray-950/80 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isSelected
                        ? 'border-blue-400/80 shadow-lg shadow-blue-500/30'
                        : 'border-gray-800 shadow-lg shadow-black/30 hover:border-blue-500/40'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="flex justify-center">
                      <MoviePoster
                        posterUrl={movie.posterUrl}
                        title={movie.name}
                        imageClassName="h-auto w-40 rounded-md object-cover shadow-md shadow-black/40 sm:w-48"
                        placeholderClassName="flex h-60 w-40 items-center justify-center rounded-md bg-gray-800 text-sm text-gray-400 sm:w-48"
                        sizes="(max-width: 640px) 10rem, (max-width: 1024px) 12rem, 16rem"
                      />
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <p className="text-lg font-semibold text-white">{movie.name}</p>
                      <p className="text-sm text-gray-400">
                        {movie.releaseYear ? `Released ${movie.releaseYear}` : 'Release year unknown'}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-500/90 px-3 py-1 text-xs font-semibold text-white">
                        Selected
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && (
        <div className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-green-500/60 bg-green-500/10 px-4 py-3 text-sm text-green-200 shadow">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting || !isAuthenticated || movies.length === 0}
          className="inline-flex items-center rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating group…' : 'Create ranking group'}
        </button>
        {!isAuthenticated && (
          <p className="text-sm text-gray-300">
            Sign in from the homepage to unlock group creation.
          </p>
        )}
      </div>
    </form>
  );
};

export default CreateMovieGroupForm;
