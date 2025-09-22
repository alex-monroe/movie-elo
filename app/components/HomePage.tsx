import React from 'react';

import AuthForm from './AuthForm';

const HomePage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4 text-white">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl text-center md:text-left">
          <h1 className="text-5xl font-bold md:text-6xl">Welcome to MovElo</h1>
          <p className="mt-4 text-lg text-gray-200 md:text-xl">
            MovElo is your personal movie ranking companion. Compare your favorite films to build a definitive list that reflects
            your taste.
          </p>
          <p className="mt-4 text-base text-gray-300">
            Create an account or sign in to start saving your match-ups and track how your rankings change over time.
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
};

export default HomePage;
