// 各主题的画布底色，与 globals.css 中的 --canvas 保持一致；浏览器状态栏颜色和 PWA 清单共用。
export const THEME_COLORS = {
  default: "#140507",
  cyber: "#050c18",
  sepia: "#140c04",
  noir: "#09090b",
} as const;

export type ThemeId = keyof typeof THEME_COLORS;

export const THEME_STORAGE_KEY = "bingetrack-theme";

/** 首帧前执行：只应用已知主题，并同步状态栏颜色，避免刷新后回退为默认色。 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=${JSON.stringify(THEME_COLORS)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!t||t==="default"||!Object.prototype.hasOwnProperty.call(c,t))return;document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c[t]);}catch(e){}})();`;
