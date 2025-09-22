import CreateMovieGroupForm from './CreateMovieGroupForm';

import { MOVIE_POSTER_SIZE, fetchMovieRecords, parseMovieReleaseYear } from '@/lib/movies';
import { buildPosterUrl, getTmdbConfiguration } from '@/lib/tmdb';

export const revalidate = 0;

export default async function CreateGroupPage() {
  const [movies, tmdbConfig] = await Promise.all([fetchMovieRecords(), getTmdbConfiguration()]);

  const movieOptions = movies.map((movie) => ({
    id: movie.id,
    name: movie.name,
    posterUrl: buildPosterUrl(tmdbConfig, movie.image_path, MOVIE_POSTER_SIZE),
    releaseYear: parseMovieReleaseYear(movie.metadata ?? null),
  }));

  return (
    <main className="min-h-screen bg-gray-900 px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-4xl font-bold sm:text-5xl">Create a movie ranking group</h1>
          <p className="text-lg text-gray-300">
            Curate a collection of uploaded movies and invite friends to rank them head-to-head. You can come back later to add
            more films as your library grows.
          </p>
        </header>

        <CreateMovieGroupForm movies={movieOptions} />
      </div>
    </main>
  );
}
