'use client';

import React from 'react';
import { Tv } from 'lucide-react';

const LivestreamsPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center animate-fade-in select-none">
      <Tv className="w-16 h-16 text-gray-600 dark:text-gray-700 mb-8" />
      <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
        COMING SOON
      </h1>
      <p className="mt-4 text-gray-500 dark:text-gray-500 text-sm uppercase tracking-widest font-bold">
        Livestream feature on Stellar
      </p>
    </div>
  );
};

export default LivestreamsPage;
