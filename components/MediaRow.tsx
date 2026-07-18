export default function MediaRow({ title, items }: { title: string, items: any[] }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-3 pr-1">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-200">{title}</h2>
      </div>
      
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-3 px-1">
        {items.map((item) => (
          <div key={item.media_items.id} className="flex-none w-40 group cursor-pointer flex flex-col">
            <div className="h-60 w-full bg-neutral-900 rounded-md overflow-hidden relative flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5">
              {item.media_items.cover_url ? (
                <img src={item.media_items.cover_url} alt={item.media_items.title} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
              )}
            </div>
            <div className="mt-2.5 flex flex-col space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">{item.media_items.release_date}</span>
                <span className="text-neutral-300 font-medium">★ {item.rating || '未评'}</span>
              </div>
              <p className="text-[11px] text-neutral-600 truncate">
                {item.media_items.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}