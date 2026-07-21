"use client";

import Link from "next/link";

interface Movie {
  id: string | number;
  cover_url?: string;
  title: string;
  status?: string;
  date?: string;
  rating?: number | string;
  genres?: string[];
  languages?: string[];
}

interface Stats {
  total: number;
  watched: number;
  want: number;
  upcoming: number;
}

interface TagProps {
  label: string;
}

interface MovieCatalogProps {
  watched: Movie[];
  want: Movie[];
  stats?: Stats;
}

interface MediaRowProps {
  title: string;
  items: Movie[];
}

function Tag({ label }: TagProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
      {label}
    </span>
  );
}

export default function MovieCatalog({ 
  watched, 
  want, 
  stats 
}: MovieCatalogProps) {
  const totalTracked = stats?.total;
  const totalWatched = stats?.watched;
  const totalWant = stats?.want;
  const totalUpcoming = stats?.upcoming;

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

      <div className="space-y-8">
        <MediaRow title="我看过" items={watched} />
        <MediaRow title="我想看" items={want} />
      </div>
    </div>
  );
}

function MediaRow({
  title,
  items,
}: {
  title: string;
  items: Movie[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex justify-between items-end mb-3 pr-1">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-200">
          {title}
        </h2>
      </div>
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-3 px-1 snap-x snap-mandatory scroll-pl-2">
        {items.map((movie:any) => (
          <Link href={`/movie/${movie.id}`} 
            key={movie.id} 
            className="flex-none w-44 cursor-pointer flex flex-col snap-start bg-[#181818] border border-neutral-800 rounded-md overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-neutral-700"
          >
            <div className="h-68 w-full bg-neutral-900 relative flex items-center justify-center">
              {movie.cover_url ? (
                <img src={movie.cover_url} alt={movie.title} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
              )}
            </div>
            <div className="flex flex-col space-y-1 grow px-2 py-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">{movie.date}</span>
                <span className="text-neutral-300 font-semibold flex items-center gap-1">
                  {movie.rating ? <><i className="fas fa-star text-yellow-500 text-[10px]"></i>{movie.rating}</> : <span className="text-neutral-400">未评分</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(movie.genres ?? []).map((g:string, i:string) => <Tag key={`g-${i}`} label={g} />)}
                {(movie.languages ?? []).map((l:string, i:string) => <Tag key={`l-${i}`} label={l} />)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}