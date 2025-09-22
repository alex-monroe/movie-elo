import React from 'react';

const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Welcome to MovElo</h1>
      <p className="text-xl mb-8 text-center max-w-2xl">
        MovElo is an app where you can compare your favorite movies to each other to come up with your personal definitive movie rankings.
      </p>
      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Get Started
      </button>
    </div>
  );
};

export default HomePage;
