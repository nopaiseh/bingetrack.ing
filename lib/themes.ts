// 各主题的画布底色，与 globals.css 中的 --canvas 保持一致；浏览器状态栏颜色和 PWA 清单共用。
export const THEME_COLORS = {
  default: "#13051a",
  lagoon: "#02111b",
  golden: "#160a05",
} as const;

export type ThemeId = keyof typeof THEME_COLORS;

// 各主题对应的标签页图标文件名（public/icons/favicon-{色名}.svg 与 -32.png）；PWA 主屏图标固定为默认主题的粉色，不随主题变化。
export const THEME_FAVICONS: Record<ThemeId, string> = {
  default: "pink",
  lagoon: "teal",
  golden: "amber",
};

export const FAVICON_SVG_ID = "favicon-svg";
export const FAVICON_PNG_ID = "favicon-png";

/** 把标签页图标与状态栏颜色同步到指定主题；未知主题回落到默认主题。 */
export function syncBrandToTheme(themeId: ThemeId): void {
  const id: ThemeId = Object.prototype.hasOwnProperty.call(THEME_COLORS, themeId) ? themeId : "default";
  const color = THEME_FAVICONS[id];
  document.getElementById(FAVICON_SVG_ID)?.setAttribute("href", `/icons/favicon-${color}.svg`);
  document.getElementById(FAVICON_PNG_ID)?.setAttribute("href", `/icons/favicon-${color}-32.png`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[id]);
}

export const THEME_STORAGE_KEY = "bingetrack-theme";

/** 首帧前执行：只应用已知主题，并同步状态栏颜色与标签页图标，避免刷新后回退为默认色；已下线的旧主题（cyber、sepia、noir）会回落到默认主题。 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=${JSON.stringify(THEME_COLORS)};var f=${JSON.stringify(THEME_FAVICONS)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!t||t==="default"||!Object.prototype.hasOwnProperty.call(c,t))return;document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c[t]);var s=document.getElementById(${JSON.stringify(FAVICON_SVG_ID)});if(s)s.setAttribute("href","/icons/favicon-"+f[t]+".svg");var p=document.getElementById(${JSON.stringify(FAVICON_PNG_ID)});if(p)p.setAttribute("href","/icons/favicon-"+f[t]+"-32.png");}catch(e){}})();`;
