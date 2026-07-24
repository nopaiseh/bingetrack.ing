import ItemCard from "./ItemCard";

export default function MediaRow({ title, items }: { title: string, items: any[] }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-3 pr-1">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-200">{title}</h2>
      </div>
      
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-3 px-1">
        {items.map((item) => (
          <ItemCard key={item.media_items.id} item={item} />
        ))}
      </div>
    </div>
  );
}