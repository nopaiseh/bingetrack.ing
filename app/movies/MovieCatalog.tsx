"use client";

import { useState, useEffect } from "react";

type Movie = {
  id: string;
  title: string;
  date: string;
  rating: number | null;
  genre: string;
  language: string;
  status: string;
  summary: string;
  cover_url: string;
};

export default function MovieCatalog({ watched, want }: { watched: Movie[], want: Movie[] }) {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // Dynamic calculations for your live database stats
  const totalWatched = watched.length;
  const totalWant = want.filter(m => m.status === 'want_to_watch').length;
  const totalUpcoming = want.filter(m => m.status === 'upcoming').length;
  const totalTracked = totalWatched + totalWant + totalUpcoming;

  // ... (keep the useEffect for Escape key) ...

  return (
    <div className="container w-full mx-auto px-6 md:px-8 max-w-7xl pb-16">
        <div className="flex flex-wrap -mx-2 mb-10 mt-6">
        {[
          { label: "总追踪数", value: totalTracked },
          { label: "已观看电影", value: totalWatched },
          { label: "想看的电影", value: totalWant },
          { label: "即将上映", value: totalUpcoming },
        ].map((stat, idx) => (
          <div key={idx} className="w-full sm:w-1/2 md:w-1/4 p-2">
            <div className="border border-neutral-800 rounded-md p-5">
              <h2 className="font-medium uppercase text-neutral-500 text-xs tracking-wider">{stat.label}</h2>
              <p className="font-semibold text-2xl mt-1.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-8">
        <MediaRow title="我看过" items={watched} onSelect={setSelectedMovie} />
        <MediaRow title="我想看" items={want} onSelect={setSelectedMovie} />
      </div>

      {/* Detail Modal */}
      <div 
        className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 ${selectedMovie ? 'active' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedMovie(null);
        }}
      >
        {selectedMovie && (
          <div className="modal-panel bg-[#181818] border border-neutral-800 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-48 flex-shrink-0">
                <div className="h-72 sm:h-full w-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                  {selectedMovie.cover_url ? (
                    <img src={selectedMovie.cover_url} alt={selectedMovie.title} className="w-full h-full object-cover" />
                  ) : (
                    <i className="fas fa-image text-5xl text-neutral-700 opacity-40"></i>
                  )}
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white leading-snug">{selectedMovie.title}</h3>
                  <button onClick={() => setSelectedMovie(null)} className="text-neutral-500 hover:text-white transition-colors ml-4 -mr-2 -mt-2 p-1">
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400">{selectedMovie.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-star text-yellow-500 text-xs"></i>
                    <span className="text-neutral-200 font-medium">{selectedMovie.rating ? `${selectedMovie.rating} / 10` : '未评分'}</span>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5 text-sm">
                  <div className="flex gap-2"><span className="text-neutral-500 w-16 flex-shrink-0">类型</span><span className="text-neutral-300">{selectedMovie.genre}</span></div>
                  <div className="flex gap-2"><span className="text-neutral-500 w-16 flex-shrink-0">语言</span><span className="text-neutral-300">{selectedMovie.language}</span></div>
                </div>
                <div className="mt-5 pt-5 border-t border-neutral-800">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">简介</h4>
                  <p className="text-sm text-neutral-300 leading-relaxed">{selectedMovie.summary}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable Row Component
function MediaRow({ title, items, onSelect }: { title: string, items: Movie[], onSelect: (m: Movie) => void }) {
  if (items.length === 0) return null; // Don't show empty rows
  
  return (
    <div>
      <div className="flex justify-between items-end mb-3 pr-1">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-200">{title}</h2>
      </div>
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-3 px-1 snap-x snap-mandatory scroll-pl-2">
        {items.map((movie) => (
          <div key={movie.id} onClick={() => onSelect(movie)} className="flex-none w-40 group cursor-pointer flex flex-col snap-start">
            <div className="h-60 w-full bg-neutral-900 rounded-md overflow-hidden relative flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5">
              {movie.cover_url ? (
                <img src={movie.cover_url} alt={movie.title} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
              )}
            </div>
            <div className="mt-2.5 flex flex-col space-y-1 flex-grow">
              <div className="flex justify-between items-center text-xs">
                <span className={movie.status === 'upcoming' ? 'text-red-400 font-medium' : 'text-neutral-500'}>{movie.date}</span>
                <span className="text-neutral-300 font-medium flex items-center gap-1">
                  {movie.rating ? <><i className="fas fa-star text-yellow-500 text-[10px]"></i>{movie.rating}</> : <span className="text-neutral-600">未评分</span>}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 truncate">{movie.genre}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}