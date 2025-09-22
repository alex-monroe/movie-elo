import { NextRequest, NextResponse } from 'next/server';
import Papa, { ParseError } from 'papaparse';

import { supabaseAdminClient } from '@/lib/supabaseAdminClient';
import { getMovieItemTypeId } from '@/lib/itemTypes';

type CsvRow = Record<string, string | undefined>;

type NormalizedRow = Record<string, string>;

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  poster_path?: string | null;
  release_date?: string | null;
};

type TmdbSearchResponse = {
  results?: TmdbMovie[];
};

type InsertedMovie = {
  rowNumber: number;
  name: string;
  externalId: string;
  posterPath: string | null;
  releaseDate?: string | null;
};

type SkippedMovie = {
  rowNumber: number;
  name?: string;
  reason: string;
};

type UploadError = {
  rowNumber: number;
  message: string;
  name?: string;
};

type ParseWarning = {
  type: ParseError['type'];
  code: ParseError['code'];
  message: string;
  row?: number;
};

const NAME_HEADERS = ['name', 'title'];
const YEAR_HEADERS = ['year'];
const DATE_HEADERS = ['date'];

const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';

const normalizeRow = (row: CsvRow): NormalizedRow => {
  const normalizedEntries = Object.entries(row).reduce<NormalizedRow>((acc, [key, value]) => {
    if (!key) {
      return acc;
    }

    const normalizedKey = key.trim().toLowerCase();

    if (!normalizedKey) {
      return acc;
    }

    const trimmedValue = value?.toString().trim();

    if (trimmedValue) {
      acc[normalizedKey] = trimmedValue;
    }

    return acc;
  }, {});

  return normalizedEntries;
};

const getFirstAvailableValue = (row: NormalizedRow, headers: string[]): string | undefined => {
  for (const header of headers) {
    const value = row[header];

    if (value) {
      return value;
    }
  }

  return undefined;
};

const parseWarningsFromErrors = (errors: ParseError[]): ParseWarning[] =>
  errors.map(({ type, code, message, row }) => ({
    type,
    code,
    message,
    row,
  }));

const fetchTmdbMovie = async (name: string, year: number | undefined, apiKey: string) => {
  const searchParams = new URLSearchParams({
    query: name,
    api_key: apiKey,
    include_adult: 'false',
  });

  if (year) {
    searchParams.set('year', String(year));
  }

  const response = await fetch(`${TMDB_SEARCH_URL}?${searchParams.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`TMDb search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as TmdbSearchResponse;
  const [match] = payload.results ?? [];

  return match ?? null;
};

export async function POST(request: NextRequest) {
  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;

    if (!tmdbApiKey) {
      return NextResponse.json(
        { error: 'TMDB_API_KEY environment variable is not configured.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A CSV file is required for upload.' }, { status: 400 });
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'The uploaded CSV file is empty.' }, { status: 400 });
    }

    const parsed = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    const parseWarnings = parseWarningsFromErrors(parsed.errors);

    const rows = parsed.data.filter((row) =>
      Object.values(row).some((value) => value !== undefined && value !== null && `${value}`.trim())
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No rows found in the CSV after parsing.', parseWarnings },
        { status: 400 }
      );
    }

    const movieItemTypeId = await getMovieItemTypeId();

    const inserted: InsertedMovie[] = [];
    const skipped: SkippedMovie[] = [];
    const errors: UploadError[] = [];
    const seenExternalIds = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const normalizedRow = normalizeRow(row);
      const rowNumber = index + 2; // Account for the header row in spreadsheets.
      const name = getFirstAvailableValue(normalizedRow, NAME_HEADERS);

      if (!name) {
        skipped.push({
          rowNumber,
          reason: 'Row skipped because the Name column is missing or empty.',
        });
        continue;
      }

      const yearValue = getFirstAvailableValue(normalizedRow, YEAR_HEADERS);
      const parsedYear = yearValue ? Number.parseInt(yearValue, 10) : undefined;
      const year = Number.isNaN(parsedYear) ? undefined : parsedYear;
      const csvDate = getFirstAvailableValue(normalizedRow, DATE_HEADERS);

      try {
        const tmdbMovie = await fetchTmdbMovie(name, year, tmdbApiKey);

        if (!tmdbMovie) {
          skipped.push({
            rowNumber,
            name,
            reason: 'No TMDb match was found for this row.',
          });
          continue;
        }

        const externalId = String(tmdbMovie.id);

        if (seenExternalIds.has(externalId)) {
          skipped.push({
            rowNumber,
            name: tmdbMovie.title ?? name,
            reason: 'Duplicate TMDb result detected within the uploaded CSV.',
          });
          continue;
        }

        const { data: existingMovie, error: existingMovieError } = await supabaseAdminClient
          .from('rankable_items')
          .select('id')
          .eq('external_id', externalId)
          .maybeSingle();

        if (existingMovieError) {
          throw existingMovieError;
        }

        if (existingMovie) {
          skipped.push({
            rowNumber,
            name: tmdbMovie.title ?? name,
            reason: 'Movie already exists in the library.',
          });
          continue;
        }

        const { error: insertError } = await supabaseAdminClient.from('rankable_items').insert({
          item_type_id: movieItemTypeId,
          external_id: externalId,
          name: tmdbMovie.title ?? name,
          image_path: tmdbMovie.poster_path ?? null,
          metadata: {
            source: 'csv-upload',
            csv: {
              providedName: name,
              providedYear: yearValue ?? null,
              providedDate: csvDate ?? null,
            },
            tmdb: {
              id: tmdbMovie.id,
              title: tmdbMovie.title ?? null,
              original_title: tmdbMovie.original_title ?? null,
              release_date: tmdbMovie.release_date ?? null,
              poster_path: tmdbMovie.poster_path ?? null,
            },
          },
        });

        if (insertError) {
          if ('code' in insertError && insertError.code === '23505') {
            skipped.push({
              rowNumber,
              name: tmdbMovie.title ?? name,
              reason: 'Movie already exists in the library.',
            });
            continue;
          }

          throw insertError;
        }

        seenExternalIds.add(externalId);

        inserted.push({
          rowNumber,
          name: tmdbMovie.title ?? name,
          externalId,
          posterPath: tmdbMovie.poster_path ?? null,
          releaseDate: tmdbMovie.release_date ?? null,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred.';

        errors.push({
          rowNumber,
          name,
          message,
        });
      }
    }

    return NextResponse.json({
      summary: {
        totalRows: rows.length,
        insertedCount: inserted.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
      },
      inserted,
      skipped,
      errors,
      parseWarnings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
