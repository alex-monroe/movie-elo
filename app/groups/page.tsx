import Link from 'next/link';

import NavigationBar from '@/app/components/NavigationBar';

import { fetchMovieRankingGroups } from '@/lib/groups';

export const revalidate = 0;

const FALLBACK_DESCRIPTION = 'No description provided for this group yet.';

export default async function GroupSelectionPage() {
  const groups = await fetchMovieRankingGroups();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <NavigationBar />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-4xl font-bold sm:text-5xl">Choose a ranking group</h1>
          <p className="text-lg text-gray-300">
            Pick a group to jump into the head-to-head rating experience.
          </p>
        </header>

        {groups.length === 0 ? (
          <section className="rounded-lg border border-gray-800 bg-gray-950/60 px-6 py-10 text-center shadow-lg shadow-black/30 sm:text-left">
            <h2 className="text-2xl font-semibold text-white">No groups found</h2>
            <p className="mt-3 text-sm text-gray-300">
              Create a ranking group to get started, then invite friends to help build the list.
            </p>
            <div className="mt-6 flex justify-center sm:justify-start">
              <Link
                href="/groups/new"
                className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
              >
                Create a group
              </Link>
            </div>
          </section>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {groups.map((group) => {
              const description = group.description?.trim();

              return (
                <li key={group.id} className="h-full">
                  <Link
                    href={`/groups/${group.id}/compare`}
                    className="flex h-full flex-col justify-between gap-6 rounded-lg border border-gray-800 bg-gray-950/60 p-6 shadow-lg shadow-black/30 transition hover:border-blue-500 hover:bg-gray-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
                  >
                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-white">{group.name}</h2>
                      <p className="text-sm text-gray-300">
                        {description && description.length > 0 ? description : FALLBACK_DESCRIPTION}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="font-mono text-gray-500" aria-label="Group identifier">
                        {group.id}
                      </span>
                      <span className="text-blue-400">Start ranking →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
