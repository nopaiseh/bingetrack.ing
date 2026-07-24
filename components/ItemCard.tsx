// components/ItemCard.tsx
export default function ItemCard({ item }: { item: any }) {
  return (
    <>
      <div className="h-68 w-full bg-neutral-900 relative flex items-center justify-center">
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
        )}
      </div>
      <div className="flex flex-col space-y-1 grow px-2 py-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-neutral-400">{item.date || item.release_date}</span>
          <span className="text-neutral-300 font-semibold flex items-center gap-1">
            {item.rating ? (
              <>
                <i className="fas fa-star text-yellow-500 text-[10px]"></i>
                {Number(item.rating).toFixed(1)}
              </>
            ) : (
              <span className="text-neutral-400">未评分</span>
            )}
          </span>
        </div>
        
        {/* 标签区域 (Genres & Languages) */}
        <div className="flex flex-wrap gap-1">
          {(item.genres ?? []).map((g: string, i: number) => (
            <span key={`g-${i}`} className="inline-flex items-center px-1 py-1 rounded-md bg-white/3 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-sm">
              {g}
            </span>
          ))}
          {(item.languages ?? []).map((l: string, i: number) => (
            <span key={`l-${i}`} className="inline-flex items-center px-1 py-1 rounded-md bg-white/3 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-sm">
              {l}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}