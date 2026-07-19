"use client";

import { useState, useEffect } from "react";

type Movie = {
  id: string;
  title: string;
  date: string;
  rating: number | null;
  genres: string[];
  languages: string[];
  regions: string[];
  series: string | null;
  status: string;
  summary: string;
  cover_url: string;
  casts: string[];
};

function Tag({ label }: { label: string }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation(); // Prevent opening modal when clicking a tag
        // Future: trigger search/filter here
        console.log('Filter by:', label);
      }}
      className="inline-block bg-neutral-800 text-neutral-300 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer"
    >
      {label}
    </span>
  );
}

export default function MovieCatalog({ 
  watched, 
  want, 
  stats 
}: { 
  watched: Movie[], 
  want: Movie[], 
  stats?: { total: number, watched: number, want: number, upcoming: number } 
}) {
  // If stats passed, use them; otherwise calculate from filtered arrays
  const totalTracked = stats?.total ?? watched.length + want.filter(m => m.status === 'want_to_watch' || m.status === 'upcoming').length;
  const totalWatched = stats?.watched ?? watched.length;
  const totalWant = stats?.want ?? want.filter(m => m.status === 'want_to_watch').length;
  const totalUpcoming = stats?.upcoming ?? want.filter(m => m.status === 'upcoming').length;

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  useEffect(() => {
    if (!selectedMovie) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMovie(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedMovie]);

  return (
    <div className="container w-full mx-auto px-6 md:px-8 max-w-7xl pb-16">
      <div className="flex flex-wrap -mx-2 mb-10 mt-6">
        {[
          { label: "电影总数量", value: totalTracked },
          { label: "已观看电影", value: totalWatched },
          { label: "想看的电影", value: totalWant },
          { label: "近期将上映", value: totalUpcoming },
        ].map((stat, idx) => (
          <div key={idx} className="w-full sm:w-1/2 md:w-1/4 p-2">
            <div className="border border-neutral-800 rounded-md p-5">
              <h2 className="font-medium uppercase text-neutral-500 text-xs tracking-wider">
                {stat.label}
              </h2>
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
        className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 ${selectedMovie ? "active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedMovie(null);
        }}
      >
        {selectedMovie && (
          <div className="modal-panel bg-[#181818] border border-neutral-800 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-84 shrink-0">
                <div className="h-72 sm:h-full w-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                  {selectedMovie.cover_url ? (
                    <img
                      src={selectedMovie.cover_url}
                      alt={selectedMovie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <i className="fas fa-image text-5xl text-neutral-700 opacity-40"></i>
                  )}
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white leading-snug">
                    {selectedMovie.title}
                  </h3>
                  <button
                    onClick={() => setSelectedMovie(null)}
                    className="text-neutral-500 hover:text-white transition-colors ml-4 -mr-2 -mt-2 p-1"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400">
                      {selectedMovie.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-star text-yellow-500 text-xs"></i>
                    <span className="text-neutral-200 font-medium">
                      {selectedMovie.rating
                        ? `${selectedMovie.rating} / 10`
                        : "未评分"}
                    </span>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5 text-sm">
                  <div className="flex gap-2 items-start">
                    <span className="text-neutral-500 w-16 shrink-0">
                      类型
                    </span>
                    <span className="text-neutral-300 w-1/2 flex flex-wrap gap-1">
                      {selectedMovie.genres.length > 0
                        ? selectedMovie.genres.map((g, i) => <Tag key={`mg-${i}`} label={g} />)
                        : <span className="text-neutral-600">暂无</span>}
                    </span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-neutral-500 w-16 shrink-0">
                      语言
                    </span>
                    <span className="text-neutral-300 w-1/2 flex flex-wrap gap-1">
                      {selectedMovie.languages.length > 0
                        ? selectedMovie.languages.map((l, i) => <Tag key={`ml-${i}`} label={l} />)
                        : <span className="text-neutral-600">暂无</span>}
                    </span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-neutral-500 w-16 shrink-0">
                      地区
                    </span>
                    <span className="text-neutral-300 w-1/2 flex flex-wrap gap-1">
                      {selectedMovie.regions.length > 0
                        ? selectedMovie.regions.map((r, i) => <Tag key={`mr-${i}`} label={r} />)
                        : <span className="text-neutral-600">暂无</span>}
                    </span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-neutral-500 w-16 shrink-0">
                      主演
                    </span>
                    <span className="text-neutral-300 w-1/2 flex flex-wrap gap-1">
                        {selectedMovie.casts.length > 0
                            ? selectedMovie.casts.map((c, i) => <Tag key={`mc-${i}`} label={c} />)
                            : <span className="text-neutral-600">暂无</span>}
                    </span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-neutral-500 w-16 shrink-0">
                      系列
                    </span>
                    <span className="text-neutral-300 w-1/2 flex flex-wrap gap-1">
                        {selectedMovie.series != null && selectedMovie.series.length > 0
                            ? <Tag key={`ms-${selectedMovie.series}`} label={selectedMovie.series} />
                            : <Tag label="独立电影" />}
                    </span>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-neutral-800">
                  <h4 className="text-sm font-medium uppercase tracking-wider text-neutral-500 mb-2">
                    简介
                  </h4>
                  <div className="max-h-[12em] overflow-y-auto pr-2">
                    <p className="text-sm text-neutral-300 leading-relaxed">{selectedMovie.summary}</p>
                  </div>
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
function MediaRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Movie[];
  onSelect: (m: Movie) => void;
}) {
  if (items.length === 0) return null; // Don't show empty rows

  return (
    <div>
      <div className="flex justify-between items-end mb-3 pr-1">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-200">
          {title}
        </h2>
      </div>
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-3 px-1 snap-x snap-mandatory scroll-pl-2">
        {items.map((movie) => (
          <div key={movie.id} onClick={() => onSelect(movie)} className="flex-none w-44 cursor-pointer flex flex-col snap-start bg-[#181818] border border-neutral-800 rounded-md overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-neutral-700">
            <div className="h-68 w-full bg-neutral-900 relative flex items-center justify-center">
              {movie.cover_url ? (
                <img src={movie.cover_url} alt={movie.title} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
              )}
            </div>
            <div className="mt-2 flex flex-col space-y-1 grow px-4 py-2">
              <div className="flex justify-between items-center text-xs">
                <span className={movie.status === 'upcoming' ? 'text-red-400 font-medium' : 'text-neutral-400'}>{movie.date}</span>
                <span className="text-neutral-300 font-semibold flex items-center gap-1">
                  {movie.rating ? <><i className="fas fa-star text-yellow-500 text-[10px]"></i>{movie.rating}</> : <span className="text-neutral-400">未评分</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(movie.genres?? []).map((g, i) => <Tag key={`g-${i}`} label={g} />)}
                {(movie.languages?? []).map((l, i) => <Tag key={`l-${i}`} label={l} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
