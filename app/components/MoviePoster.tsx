'use client';

import Image from 'next/image';
import type { ComponentPropsWithoutRef } from 'react';

type MoviePosterProps = {
  posterUrl: string | null;
  title: string;
  imageClassName?: string;
  placeholderClassName?: string;
  sizes?: ComponentPropsWithoutRef<typeof Image>['sizes'];
};

const DEFAULT_IMAGE_CLASS =
  'h-auto w-48 rounded-md object-cover shadow-md shadow-black/50 sm:w-60';
const DEFAULT_PLACEHOLDER_CLASS =
  'flex h-72 w-48 items-center justify-center rounded-md bg-gray-800 text-sm text-gray-400 sm:w-60';
const DEFAULT_SIZES = '(max-width: 640px) 12rem, (max-width: 1024px) 15rem, 20rem';

const MoviePoster = ({
  posterUrl,
  title,
  imageClassName = DEFAULT_IMAGE_CLASS,
  placeholderClassName = DEFAULT_PLACEHOLDER_CLASS,
  sizes = DEFAULT_SIZES,
}: MoviePosterProps) => {
  if (!posterUrl) {
    return <div className={placeholderClassName}>Poster unavailable</div>;
  }

  return (
    <Image
      src={posterUrl}
      alt={`${title} poster`}
      width={342}
      height={513}
      className={imageClassName}
      sizes={sizes}
    />
  );
};

export default MoviePoster;
