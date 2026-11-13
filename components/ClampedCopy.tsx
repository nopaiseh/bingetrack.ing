/** 大约三行中文。更短的简介不显示展开控件。 */
const OVERVIEW_CLAMP_CHARACTERS = 72;

/** 长简介或超过三行的文本才在窄屏收起；短句保持普通段落。 */
export function overviewNeedsClamp(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > OVERVIEW_CLAMP_CHARACTERS || trimmed.split("\n").length > 3;
}

/**
 * 窄屏把长简介收成三行，并用原生 details 展开，不依赖脚本。
 * 宽屏默认取消行数限制，同时把行宽限制在约 70ch，避免桌面一行超过一百个汉字。
 * persistClamp 在宽屏也保持收起，详情页的「展开全文」用这个。
 */
export default function ClampedCopy({
  text,
  className = "",
  persistClamp = false,
  expandLabel = "展开简介 ▾",
  collapseLabel = "收起简介 ▴",
}: {
  text: string;
  className?: string;
  persistClamp?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const body = `max-w-[70ch] whitespace-pre-line text-left text-sm leading-7 tracking-wide text-fg-secondary wrap-break-word md:text-base ${className}`;
  if (!overviewNeedsClamp(text)) return <p className={body}>{text}</p>;

  return (
    <details className={persistClamp ? "overview-clamp overview-clamp-persist" : "overview-clamp"}>
      <summary>
        <span className={`overview-clamp-text ${body}`}>{text}</span>
        <span className={`overview-toggle mt-1.5 inline-block text-sm text-[var(--accent-hover)] ${persistClamp ? "" : "lg:hidden"}`}>
          <span className="overview-expand-closed">{expandLabel}</span>
          <span className="overview-expand-open">{collapseLabel}</span>
        </span>
      </summary>
    </details>
  );
}
