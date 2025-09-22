import NavigationBar from '@/app/components/NavigationBar';

import UserRatingsExplorer from './UserRatingsExplorer';

import { getTmdbConfiguration } from '@/lib/tmdb';

export const revalidate = 0;

const RatingsPage = async () => {
  let tmdbConfig: Awaited<ReturnType<typeof getTmdbConfiguration>> | null = null;

  try {
    tmdbConfig = await getTmdbConfiguration();
  } catch (error) {
    console.warn('TMDb configuration could not be loaded for the ratings page:', error);
    tmdbConfig = null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <NavigationBar />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-4xl font-bold sm:text-5xl">My movie ratings</h1>
          <p className="text-lg text-gray-300">
            Review how your Elo scores stack up across each ranking group you participate in.
          </p>
        </header>

        <UserRatingsExplorer tmdbConfig={tmdbConfig} />
      </main>
    </div>
  );
};

export default RatingsPage;
