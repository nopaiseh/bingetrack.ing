"use client";

import { useEffect, useState } from "react";

const PALETTES = [
  { id: "default", name: "红毯经典", colorClass: "bg-rose-500", glowColor: "rgba(244,63,94,0.6)" },
  { id: "cyber", name: "赛博霓虹", colorClass: "bg-sky-400", glowColor: "rgba(14,165,233,0.6)" },
  { id: "sepia", name: "复古胶片", colorClass: "bg-amber-400", glowColor: "rgba(245,158,11,0.6)" },
  { id: "noir", name: "黑曜钛白", colorClass: "bg-zinc-100", glowColor: "rgba(255,255,255,0.5)" },
] as const;

const THEME_COLORS: Record<string, string> = {
  default: "#140507",
  cyber: "#050c18",
  sepia: "#140c04",
  noir: "#09090b",
};

/** 提供零运行负担的影院氛围主题切换控件，并持久化到本地存储。 */
export default function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useState<string>("default");

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const saved = document.documentElement.getAttribute("data-theme") || "default";
      setCurrentTheme(saved);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const handleSelect = (themeId: string) => {
    setCurrentTheme(themeId);
    if (themeId === "default") {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.removeItem("bingetrack-theme"); } catch {}
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
      try { localStorage.setItem("bingetrack-theme", themeId); } catch {}
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLORS[themeId] || "#140507");
    }
  };

  return (
    <div
      role="group"
      aria-label="影院氛围主题"
      className="surface-control flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs backdrop-blur-md"
    >
      <span className="text-[11px] font-medium text-white/70">氛围</span>
      <div className="flex items-center gap-1">
        {PALETTES.map((palette) => {
          const isActive = currentTheme === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => handleSelect(palette.id)}
              aria-label={`切换为${palette.name}主题`}
              aria-pressed={isActive}
              title={palette.name}
              className="flex size-6 items-center justify-center rounded-full p-0 transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <span
                className={`size-3.5 rounded-full ${palette.colorClass} transition-all duration-300 ${
                  isActive
                    ? "scale-110 ring-2 ring-white/80 ring-offset-1 ring-offset-black/60 shadow-[0_0_8px_var(--un-glow)]"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  "--un-glow": palette.glowColor,
                } as React.CSSProperties}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
