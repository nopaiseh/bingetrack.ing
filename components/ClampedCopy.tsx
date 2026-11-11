/** 大约三行中文。更短的简介不显示展开控件。 */
const OVERVIEW_CLAMP_CHARACTERS = 72;

/** 长简介或超过三行的文本才在窄屏收起；短句保持普通段落。 */
export function overviewNeedsClamp(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > OVERVIEW_CLAMP_CHARACTERS || trimmed.split("\n").length > 3;
}

/**
 * 窄屏把长简介收成三行，并用原生 details 展开，不依赖脚本。
 * 宽屏取消行数限制，同时把行宽限制在约 70ch，避免桌面一行超过一百个汉字。
 */
export default function ClampedCopy({ text, className = "" }: { text: string; className?: string }) {
  const body = `max-w-[70ch] whitespace-pre-line text-left text-sm leading-7 tracking-wide text-fg-secondary wrap-break-word md:text-base ${className}`;
  if (!overviewNeedsClamp(text)) return <p className={body}>{text}</p>;

  return (
    <details className="overview-clamp">
      <summary>
        <span className={`overview-clamp-text ${body}`}>{text}</span>
        <span className="overview-toggle mt-1.5 inline-block text-[12.5px] text-[var(--accent-hover)] lg:hidden">
          <span className="overview-expand-closed">展开简介 ▾</span>
          <span className="overview-expand-open">收起简介 ▴</span>
        </span>
      </summary>
    </details>
  );
}
