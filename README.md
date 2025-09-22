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
```

- You can find these values in **Project Settings → API** within the Supabase dashboard.
- Legacy setups that already define `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` will continue to work.
- Ensure **Email** is enabled under **Authentication → Providers** so users can receive confirmation links.

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
