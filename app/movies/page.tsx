import Image from 'next/image';

import { supabaseAdminClient } from '@/lib/supabaseAdminClient';
import { getMovieItemTypeId } from '@/lib/itemTypes';
import { buildPosterUrl, getTmdbConfiguration } from '@/lib/tmdb';

export const revalidate = 0;

const MOVIE_POSTER_SIZE = 'w342';

type MovieRow = {
  id: number;
  name: string;
  image_path: string | null;
  metadata: Record<string, unknown> | null;
};

const parseReleaseYear = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const typedMetadata = metadata as {
    tmdb?: { release_date?: string | null };
    release_date?: string | null;
    releaseDate?: string | null;
  };

  const releaseDate =
    typedMetadata.tmdb?.release_date ?? typedMetadata.release_date ?? typedMetadata.releaseDate;

  if (typeof releaseDate !== 'string' || releaseDate.length < 4) {
    return null;
  }

  return releaseDate.slice(0, 4);
};

const fetchMovies = async () => {
  const movieItemTypeId = await getMovieItemTypeId();

  const { data, error } = await supabaseAdminClient
    .from<MovieRow>('rankable_items')
    .select('id, name, image_path, metadata')
    .eq('item_type_id', movieItemTypeId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export default async function MoviesPage() {
  const [movies, tmdbConfig] = await Promise.all([fetchMovies(), getTmdbConfiguration()]);

  const moviesWithPosters = movies.map((movie) => ({
    ...movie,
    posterUrl: buildPosterUrl(tmdbConfig, movie.image_path, MOVIE_POSTER_SIZE),
    releaseYear: parseReleaseYear(movie.metadata ?? null),
  }));

  return (
    <main className="min-h-screen bg-gray-900 px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-4xl font-bold sm:text-5xl">Movie Library</h1>
          <p className="text-lg text-gray-300">
            Browse every movie that&apos;s currently available for head-to-head rankings.
          </p>
        </header>

        {moviesWithPosters.length === 0 ? (
          <p className="text-center text-gray-300 sm:text-left">
            No movies have been added yet. Upload a CSV to start building the library.
          </p>
        ) : (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {moviesWithPosters.map((movie) => (
              <li
                key={movie.id}
                className="flex flex-col rounded-lg border border-gray-800 bg-gray-950/60 p-4 shadow-lg shadow-black/30"
              >
                <div className="flex justify-center">
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={`${movie.name} poster`}
                      width={342}
                      height={513}
                      className="h-auto w-48 rounded-md object-cover shadow-md shadow-black/50 sm:w-60"
                      sizes="(max-width: 640px) 12rem, (max-width: 1024px) 15rem, 20rem"
                    />
                  ) : (
                    <div className="flex h-72 w-48 items-center justify-center rounded-md bg-gray-800 text-sm text-gray-400 sm:w-60">
                      Poster unavailable
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2 text-center sm:text-left">
                  <h2 className="text-2xl font-semibold text-white">{movie.name}</h2>
                  {movie.releaseYear ? (
                    <p className="text-gray-400">Released {movie.releaseYear}</p>
                  ) : (
                    <p className="text-gray-500">Release year unknown</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
