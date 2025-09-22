import { cache } from 'react';

const TMDB_CONFIGURATION_URL = 'https://api.themoviedb.org/3/configuration';

export type TmdbImageConfiguration = {
  base_url: string;
  secure_base_url: string;
  backdrop_sizes: string[];
  logo_sizes: string[];
  poster_sizes: string[];
  profile_sizes: string[];
  still_sizes: string[];
};

export type TmdbConfigurationResponse = {
  images: TmdbImageConfiguration;
};

export const getTmdbConfiguration = cache(async (): Promise<TmdbConfigurationResponse> => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error('TMDB_API_KEY environment variable is not configured.');
  }

  const url = new URL(TMDB_CONFIGURATION_URL);
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`TMDb configuration request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as TmdbConfigurationResponse;

  if (!payload.images) {
    throw new Error('TMDb configuration response did not include image settings.');
  }

  return payload;
});

const selectPosterSize = (posterSizes: string[], preferredSize: string) => {
  if (posterSizes.includes(preferredSize)) {
    return preferredSize;
  }

  if (posterSizes.includes('original')) {
    return 'original';
  }

  return posterSizes.at(-1) ?? '';
};

export const buildPosterUrl = (
  config: TmdbConfigurationResponse,
  posterPath: string | null | undefined,
  preferredSize = 'w342'
): string | null => {
  if (!posterPath) {
    return null;
  }

  const { images } = config;
  const baseUrl = images.secure_base_url || images.base_url;

  if (!baseUrl) {
    return null;
  }

  const normalizedSize = selectPosterSize(images.poster_sizes ?? [], preferredSize);

  if (!normalizedSize) {
    return null;
  }

  const normalizedPath = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;

  return `${baseUrl}${normalizedSize}${normalizedPath}`;
};
