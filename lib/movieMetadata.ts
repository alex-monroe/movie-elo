export const MOVIE_POSTER_SIZE = 'w342';

export type MovieMetadata = {
  tmdb?: {
    release_date?: string | null;
  } | null;
  release_date?: string | null;
  releaseDate?: string | null;
};

export const parseMovieReleaseYear = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const typedMetadata = metadata as MovieMetadata;
  const releaseDate =
    typedMetadata.tmdb?.release_date ?? typedMetadata.release_date ?? typedMetadata.releaseDate;

  if (typeof releaseDate !== 'string' || releaseDate.length < 4) {
    return null;
  }

  return releaseDate.slice(0, 4);
};
