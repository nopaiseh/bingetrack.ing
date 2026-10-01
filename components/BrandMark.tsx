/** 品牌图标：终端提示符 `>` 加一根进度条；提示符跟随文字颜色，进度条填充跟随当前氛围的强调色。 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform="translate(50 50) scale(1.6)">
        <polyline
          points="-20.25,-14 -4.25,0 -20.25,14"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="1.75" y="8" width="22" height="7" rx="3.5" fill="currentColor" opacity="0.25" />
        <rect x="1.75" y="8" width="15" height="7" rx="3.5" fill="var(--accent)" />
      </g>
    </svg>
  );
}
