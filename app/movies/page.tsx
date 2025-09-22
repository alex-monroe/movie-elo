import MoviePoster from '../components/MoviePoster';

import { MOVIE_POSTER_SIZE, fetchMovieRecords, parseMovieReleaseYear } from '@/lib/movies';
import { buildPosterUrl, getTmdbConfiguration } from '@/lib/tmdb';

export const revalidate = 0;

export default async function MoviesPage() {
  const [movies, tmdbConfig] = await Promise.all([fetchMovieRecords(), getTmdbConfiguration()]);

  const moviesWithPosters = movies.map((movie) => ({
    ...movie,
    posterUrl: buildPosterUrl(tmdbConfig, movie.image_path, MOVIE_POSTER_SIZE),
    releaseYear: parseMovieReleaseYear(movie.metadata ?? null),
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
                  <MoviePoster posterUrl={movie.posterUrl} title={movie.name} />
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
