# MovElo

MovElo helps you build a personal movie ranking by comparing films head-to-head. The homepage now includes Supabase powered
registration and login so you can save progress across devices.

## Prerequisites

- Node.js 18 or newer
- A [Supabase](https://supabase.com/) project with email authentication enabled

## Installation

```bash
npm install
```

## Environment variables

Create a `.env.local` file in the project root with the credentials from your Supabase project:

```bash
NEXT_PUBLIC_MOVIES_ELOSUPABASE_URL=your-project-url
NEXT_PUBLIC_MOVIES_ELOSUPABASE_ANON_KEY=your-anon-key
# Required for server-side inserts used by the CSV uploader
MOVIES_ELO_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Required for lookups against The Movie Database (TMDb)
TMDB_API_KEY=your-tmdb-v3-api-key
```

- You can find these values in **Project Settings → API** within the Supabase dashboard.
- Legacy setups that already define `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` will continue to work.
- `MOVIES_ELO_SUPABASE_SERVICE_ROLE_KEY` can be substituted with `SUPABASE_SERVICE_ROLE_KEY` if you already use that variable name.
- `TMDB_API_KEY` should be a TMDb v3 API key. The uploader uses it to call the `/search/movie` endpoint.
- Ensure **Email** is enabled under **Authentication → Providers** so users can receive confirmation links.

## Bulk movie uploads

Signed-in users can upload a CSV containing `Date`, `Name`, and `Year` columns from the homepage. During upload the
application:

1. Parses the CSV (ignoring any additional columns).
2. Searches TMDb for each row using the provided name and year.
3. Inserts matches into the `rankable_items` table when a TMDb ID is not already present.

Each upload returns a summary of movies that were added, skipped (missing data, no TMDb match, or duplicates), and any
errors encountered while contacting TMDb or Supabase.

## Head-to-head rankings

1. Create a ranking group from `/groups/new` and note the group ID that is returned.
2. Apply the migration at `supabase/migrations/20250211000001_create_movie_comparison_function.sql` to your database so
   match results can be processed.
3. Visit `/groups/<group-id>` (for example, `/groups/123e4567-e89b-12d3-a456-426614174000`) to load the new comparison
   interface.
4. Sign in and repeatedly pick your preferred movie in each matchup. The backend updates Elo ratings after every choice.

## Running the project

Start the local development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) to interact with the sign-up and login flow. When users create an
account, they will be prompted to confirm their email (if email confirmation is required in your Supabase settings). Once
confirmed, the session is persisted and the user can sign out from the homepage.

## Production build

To ensure the application builds successfully, run:

```bash
npm run build
```

After building, you can launch the production server with:

```bash
npm start
```

## Additional notes

- Keep your Supabase keys private—never commit `.env.local` to version control.
- If you update authentication settings (such as enabling social providers), the homepage form will work automatically with
  those providers as long as they are enabled in Supabase.
- Database tables that store ranking metadata are documented in [docs/ranking-schema.md](docs/ranking-schema.md) along with a
  migration script you can run against your Supabase project.
