import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <div className="text-white">
      <header className="flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">MovieELO</h1>
        <div className="flex gap-4">
          {session ? (
            <LogoutButton />
          ) : (
            <>
              <Link href="/login" className="bg-green-500 px-4 py-2 rounded">
                Login
              </Link>
              <Link href="/signup" className="bg-blue-500 px-4 py-2 rounded">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="text-center p-8">
        <h2 className="text-4xl font-bold mb-4">Welcome to MovieELO</h2>
        <p className="text-lg mb-8">
          The ultimate platform to rank and discover movies based on community
          votes.
        </p>
        <button className="bg-yellow-500 px-8 py-4 rounded-full font-bold text-xl">
          Start Ranking
        </button>
      </main>
    </div>
  )
}
