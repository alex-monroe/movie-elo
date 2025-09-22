'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

const NAV_LINKS = [
  { href: '/movies', label: 'Movies' },
  { href: '/groups', label: 'Groups' },
  { href: '/ratings', label: 'My ratings' },
  { href: '/groups/new', label: 'Create group' },
] as const;

const NavigationBar = () => {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingSession = !sessionChecked;
  const isSignedIn = Boolean(userEmail);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (sessionError) {
          console.warn('Failed to load Supabase session:', sessionError);
          setUserEmail(null);
        } else {
          setUserEmail(data.session?.user?.email ?? null);
        }
      } catch (sessionError) {
        if (!isMounted) {
          return;
        }

        console.warn('Failed to load Supabase session:', sessionError);
        setUserEmail(null);
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setUserEmail(session?.user?.email ?? null);
      setSessionChecked(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        return;
      }

      setUserEmail(null);
      router.push('/');
      router.refresh();
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : 'Unexpected error while signing out.';
      setError(message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="border-b border-gray-800 bg-gray-950/70 text-white backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <Link href="/" className="text-lg font-semibold text-white transition hover:text-blue-400">
            Prefelo
          </Link>
          {isSignedIn ? (
            <div className="flex items-center gap-4 text-sm font-medium text-gray-300 sm:hidden">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {isLoadingSession ? (
            <div className="flex items-center gap-2 text-sm text-gray-400" aria-live="polite">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-400" aria-hidden="true" />
              <span>Checking session…</span>
            </div>
          ) : isSignedIn ? (
            <>
              <div className="hidden items-center gap-4 text-sm font-medium text-gray-300 sm:flex">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="hidden h-6 w-px bg-gray-800 sm:block" aria-hidden="true" />
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-gray-400 sm:inline" title={userEmail ?? undefined}>
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-400 sm:inline">Sign in to access your rankings.</span>
              <Link
                href="/"
                className="inline-flex items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </nav>
      {error ? (
        <div className="border-t border-red-500/40 bg-red-950/40 px-4 py-2 text-sm text-red-200 sm:px-6">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default NavigationBar;
