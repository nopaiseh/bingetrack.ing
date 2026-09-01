import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import SearchTag from "@/components/SearchTag";

test.each([
  ["科幻", "genre", "/search?genre=%E7%A7%91%E5%B9%BB"],
  ["王家卫", "director", "/search?q=%E7%8E%8B%E5%AE%B6%E5%8D%AB&type=%E5%AF%BC%E6%BC%94"],
  ["复仇者联盟", "series", "/search?q=%E5%A4%8D%E4%BB%87%E8%80%85%E8%81%94%E7%9B%9F&type=%E7%B3%BB%E5%88%97"],
] as const)("builds the correct search link for %s", (label, category, href) => {
  render(<SearchTag label={label} category={category} />);
  expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
});
