'use client';

import { FormEvent, useMemo, useState } from 'react';

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

type UploadResponse = {
  summary: UploadSummary;
  inserted: UploadInserted[];
  skipped: UploadSkipped[];
  errors: UploadError[];
  parseWarnings: UploadParseWarning[];
  error?: string;
};

const MovieCsvUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError('Choose a CSV file before uploading.');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/movies/bulk-upload', {
        method: 'POST',
        body: formData,
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
      result.parseWarnings.length > 0
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
