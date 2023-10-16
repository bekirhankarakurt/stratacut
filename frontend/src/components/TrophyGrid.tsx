import { ACHIEVEMENTS } from '../utils/progression';

export default function TrophyGrid({ ids, empty }: { ids: string[]; empty: string }) {
  const items = ACHIEVEMENTS.filter((a) => ids.includes(a.id));
  if (items.length === 0) {
    return <p className="text-[11px] text-slate-500">{empty}</p>;
  }
  return (
    <div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
      {items.map((a) => (
        <div
          key={a.id}
          className="mc-block flex items-center gap-1.5 bg-gradient-to-b from-[#3a2e10] to-[#141008] px-2 py-1.5"
          title={a.desc}
        >
          <span className="text-base">{a.icon}</span>
          <span className="truncate text-[10px] font-black text-amber-100">{a.name}</span>
        </div>
      ))}
    </div>
  );
}
