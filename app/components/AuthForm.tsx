'use client';

import { FormEvent, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type AuthView = 'sign-in' | 'sign-up';

const AuthForm = () => {
  const [view, setView] = useState<AuthView>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      setUserEmail(data.session?.user?.email ?? null);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }

    if (view === 'sign-up') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        setMessage('Account created and signed in successfully.');
      } else {
        setMessage('Check your email for a confirmation link to finish signing up.');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage('Signed in successfully.');
      }
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    } else {
      setMessage('Signed out successfully.');
    }

    setLoading(false);
  };

  if (userEmail) {
    return (
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-white">You're signed in!</h2>
        <p className="mt-2 text-sm text-gray-300">
          Currently logged in as <span className="font-medium text-white">{userEmail}</span>.
        </p>
        {message && <p className="mt-4 text-sm text-green-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="mt-6 w-full rounded bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-lg">
      <div className="mb-6 flex justify-between rounded-md bg-gray-900 p-1">
        <button
          type="button"
          onClick={() => {
            setView('sign-in');
            setMessage(null);
            setError(null);
          }}
          className={`w-1/2 rounded-md px-4 py-2 text-sm font-semibold transition ${
            view === 'sign-in' ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setView('sign-up');
            setMessage(null);
            setError(null);
          }}
          className={`w-1/2 rounded-md px-4 py-2 text-sm font-semibold transition ${
            view === 'sign-up' ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'
          }`}
        >
          Create account
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
            autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-green-400">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Please wait…' : view === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
};

export default AuthForm;
