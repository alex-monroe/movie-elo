'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type UploadSummary = {
  totalRows: number;
  insertedCount: number;
  skippedCount: number;
  errorCount: number;
};

type UploadInserted = {
  rowNumber: number;
  name: string;
  externalId: string;
  posterPath: string | null;
  releaseDate?: string | null;
};

type UploadSkipped = {
  rowNumber: number;
  name?: string;
  reason: string;
};

type UploadError = {
  rowNumber: number;
  name?: string;
  message: string;
};

type UploadParseWarning = {
  type: string;
  code: string;
  message: string;
  row?: number;
};

type UploadGroup = {
  id: string;
  name: string;
  movieCount: number;
};

type UploadResponse = {
  summary: UploadSummary;
  inserted: UploadInserted[];
  skipped: UploadSkipped[];
  errors: UploadError[];
  parseWarnings: UploadParseWarning[];
  error?: string;
  group?: UploadGroup;
  groupError?: string;
};

const MovieCsvUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [createGroup, setCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setAccessToken(data.session?.access_token ?? null);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError('Choose a CSV file before uploading.');
      return;
    }

    if (createGroup) {
      if (!groupName.trim()) {
        setError('Enter a name for the ranking group.');
        return;
      }

      if (!accessToken) {
        setError('You must be signed in to create a ranking group.');
        return;
      }
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (createGroup) {
        formData.append('createGroup', 'true');
        formData.append('groupName', groupName.trim());

        if (groupDescription.trim()) {
          formData.append('groupDescription', groupDescription.trim());
        }
      }

      const headers: HeadersInit | undefined =
        createGroup && accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

      const response = await fetch('/api/movies/bulk-upload', {
        method: 'POST',
        body: formData,
        headers,
      });

      const payload = (await response.json()) as UploadResponse;

      if (!response.ok) {
        setError(payload?.error ?? 'Bulk upload failed.');
        return;
      }

      setResult(payload);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Unexpected upload error.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const hasDetails = useMemo(() => {
    if (!result) {
      return false;
    }

    return (
      result.inserted.length > 0 ||
      result.skipped.length > 0 ||
      result.errors.length > 0 ||
      result.parseWarnings.length > 0 ||
      Boolean(result.group) ||
      Boolean(result.groupError)
    );
  }, [result]);

  return (
    <div className="mt-8 w-full rounded-lg bg-gray-800 p-6 shadow-lg">
      <h3 className="text-xl font-semibold text-white">Bulk upload movies</h3>
      <p className="mt-2 text-sm text-gray-300">
        Upload a CSV with <span className="font-medium text-white">Date</span>,{' '}
        <span className="font-medium text-white">Name</span>, and{' '}
        <span className="font-medium text-white">Year</span> columns. We'll look up titles on TMDb and add any missing
        movies to your library.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="movie-upload" className="block text-sm font-medium text-gray-300">
            CSV file
          </label>
          <input
            id="movie-upload"
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(event) => {
              const [selectedFile] = Array.from(event.target.files ?? []);
              setFile(selectedFile ?? null);
            }}
            className="mt-1 block w-full cursor-pointer rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div className="rounded-md border border-gray-700 bg-gray-900 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              checked={createGroup}
              disabled={uploading}
              onChange={(event) => {
                setCreateGroup(event.target.checked);
              }}
            />
            <span className="text-sm text-gray-200">
              Create a ranking group with the uploaded movies
              <span className="block text-xs text-gray-400">
                We'll include any titles that were added or already existed in your library.
              </span>
            </span>
          </label>
          {createGroup && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="group-name" className="block text-sm font-medium text-gray-300">
                  Group name
                </label>
                <input
                  id="group-name"
                  type="text"
                  value={groupName}
                  disabled={uploading}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Summer Movie Marathon"
                  className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  required
                />
              </div>
              <div>
                <label htmlFor="group-description" className="block text-sm font-medium text-gray-300">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="group-description"
                  value={groupDescription}
                  disabled={uploading}
                  onChange={(event) => setGroupDescription(event.target.value)}
                  placeholder="Invite friends to rank the films from this upload."
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload CSV'}
        </button>
      </form>

      {result && (
        <div className="mt-6 rounded-md border border-gray-700 bg-gray-900 p-4">
          <h4 className="text-lg font-semibold text-white">Upload summary</h4>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-300 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-white">Rows processed</dt>
              <dd>{result.summary.totalRows}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Movies added</dt>
              <dd>{result.summary.insertedCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Skipped</dt>
              <dd>{result.summary.skippedCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Errors</dt>
              <dd>{result.summary.errorCount}</dd>
            </div>
          </dl>

          {result.group && (
            <div className="mt-4 rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-200">
              <p className="text-base font-semibold text-green-100">Ranking group created</p>
              <p className="mt-1">
                <span className="font-medium">{result.group.name}</span> now includes {result.group.movieCount} movie
                {result.group.movieCount === 1 ? '' : 's'}. Share the group ID{' '}
                <span className="font-mono text-green-100">{result.group.id}</span> to start ranking.
              </p>
            </div>
          )}
          {result.groupError && (
            <p className="mt-4 text-sm text-amber-300">{result.groupError}</p>
          )}

          {hasDetails && (
            <div className="mt-4 space-y-4 text-sm text-gray-300">
              {result.parseWarnings.length > 0 && (
                <details className="rounded border border-gray-700 bg-gray-950 p-3">
                  <summary className="cursor-pointer font-medium text-white">CSV parse warnings</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.parseWarnings.map((warning) => (
                      <li key={`${warning.code}-${warning.row ?? 'unknown'}`}>
                        <span className="font-medium text-white">[{warning.code}]</span> {warning.message}
                        {typeof warning.row === 'number' && <span className="text-gray-400"> (row {warning.row})</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.inserted.length > 0 && (
                <details className="rounded border border-gray-700 bg-gray-950 p-3">
                  <summary className="cursor-pointer font-medium text-white">
                    Added movies ({result.inserted.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.inserted.map((movie) => (
                      <li key={`${movie.rowNumber}-${movie.externalId}`}>
                        <span className="font-medium text-white">{movie.name}</span> — TMDb #{movie.externalId}
                        {movie.releaseDate && <span className="text-gray-400"> ({movie.releaseDate})</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.skipped.length > 0 && (
                <details className="rounded border border-gray-700 bg-gray-950 p-3">
                  <summary className="cursor-pointer font-medium text-white">
                    Skipped rows ({result.skipped.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.skipped.map((entry, index) => (
                      <li key={`${entry.rowNumber}-${index}`}>
                        Row {entry.rowNumber}
                        {entry.name && (
                          <span className="text-gray-400">
                            {' '}
                            — {entry.name}
                          </span>
                        )}
                        : {entry.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.errors.length > 0 && (
                <details className="rounded border border-gray-700 bg-gray-950 p-3">
                  <summary className="cursor-pointer font-medium text-white">
                    Errors ({result.errors.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.errors.map((entry, index) => (
                      <li key={`${entry.rowNumber}-${index}`}>
                        Row {entry.rowNumber}
                        {entry.name && <span className="text-gray-400"> — {entry.name}</span>}: {entry.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MovieCsvUpload;
