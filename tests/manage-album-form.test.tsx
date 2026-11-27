import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import MediaForm, { albumCoverPreviewSrc } from "@/app/(admin)/manage/media/MediaForm";

vi.mock("@/app/(admin)/manage/actions", () => ({
  saveMedia: vi.fn(async () => ({})),
  deleteMedia: vi.fn(),
}));
vi.mock("@/app/(admin)/manage/reference-actions", () => ({
  saveReference: vi.fn(),
  deleteReference: vi.fn(),
  searchChoices: vi.fn(async () => ({ choices: [] })),
}));

const blank = {
  alternate_title: null,
  summary: null,
  cover_url: null,
  release_date: null,
  runtime: null,
  parent_id: null,
  previous_parent_id: null,
  number: null,
  disc_number: null,
  status: "want_to_watch" as const,
  rating: null,
  genres: [] as string[],
  languages: [] as string[],
  regions: [] as string[],
  actors: [],
  directors: [],
  artists: [],
  lyricists: [],
  composers: [],
  arrangers: [],
  producers: [],
  featured: [],
  authors: [],
  page_count: null,
  publisher: null,
  isbn: null,
  label: null,
};

it("专辑表单展示厂牌、艺人选择器与正方形无封面占位", () => {
  render(
    <MediaForm
      initialType="album"
      lockType
      item={{
        id: "a1",
        type: "album",
        title: "叶惠美",
        ...blank,
        label: "阿尔发音乐",
        artists: [{ id: "p1", name: "周杰伦", alternate_name: null }],
      }}
    />,
  );
  expect(screen.getByLabelText("厂牌")).toHaveValue("阿尔发音乐");
  expect(screen.getByRole("heading", { name: "封面图片" })).toBeInTheDocument();
  expect(screen.getByText("无封面")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "艺人" })).toBeInTheDocument();
  expect(screen.getByText("周杰伦")).toBeInTheDocument();
  expect(screen.getByLabelText("发行日期")).toBeInTheDocument();
  expect(screen.getByLabelText("类型标签")).toBeInTheDocument();
  expect(screen.getByLabelText("系列")).toBeInTheDocument();
  expect(screen.getByLabelText("地区")).toBeInTheDocument();
  expect(screen.getByText("语言（来自曲目）")).toBeInTheDocument();
  expect(screen.getByText(/只读汇总：请在各曲目编辑页设置语言/)).toBeInTheDocument();
  expect(document.querySelector('input[name="languages"]')).toBeNull();
  expect(screen.queryByLabelText("时长（秒）")).not.toBeInTheDocument();
});

it("编辑页预填专辑地区，语言以只读芯片展示并集", () => {
  render(
    <MediaForm
      initialType="album"
      lockType
      item={{
        id: "a1",
        type: "album",
        title: "叶惠美",
        ...blank,
        label: "阿尔发音乐",
        languages: ["国语"],
        regions: ["台湾"],
        artists: [{ id: "p1", name: "周杰伦", alternate_name: null }],
      }}
    />,
  );
  expect(screen.getByText("台湾")).toBeInTheDocument();
  expect(screen.getByLabelText("地区")).toBeInTheDocument();
  const languages = screen.getByLabelText("由曲目汇总的语言");
  expect(languages).toHaveTextContent("国语");
  expect(document.querySelector('input[name="languages"]')).toBeNull();
});

it("曲目表单要求曲序与所属专辑，时长为整数秒，创作人员用人物选择器", () => {
  render(
    <MediaForm
      initialType="music"
      lockType
      parent={{ id: "a1", name: "叶惠美", type: "album", detail: "专辑", cover_url: null }}
      item={{
        id: "t5",
        type: "music",
        title: "东风破",
        ...blank,
        parent_id: "a1",
        number: 5,
        disc_number: null,
        runtime: 313,
        languages: ["国语"],
        artists: [{ id: "p1", name: "周杰伦", alternate_name: null }],
        lyricists: [
          { id: "p2", name: "方文山", alternate_name: null },
          { id: "p1", name: "周杰伦", alternate_name: null },
        ],
        composers: [{ id: "p1", name: "周杰伦", alternate_name: null }],
        arrangers: [],
        producers: [],
        featured: [],
      }}
    />,
  );
  expect(screen.getByLabelText("曲序")).toHaveValue(5);
  expect(screen.getByText(/同一专辑内曲序不能重复/)).toBeInTheDocument();
  // 盘号可见；null／新建时为空，不默认成 1
  expect(screen.getByLabelText("盘号")).toHaveValue(null);
  expect(screen.getByLabelText("时长（秒）")).toHaveValue(313);
  expect(screen.getByText("5:13")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "创作人员" })).toBeInTheDocument();
  expect(screen.getAllByText("演唱艺人").length).toBeGreaterThan(0);
  expect(screen.getAllByText("作词").length).toBeGreaterThan(0);
  expect(screen.getAllByText("作曲").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("评分（0–10，可留空）")).toBeInTheDocument();
  expect(screen.getByText("类型标签")).toBeInTheDocument();
  expect(screen.getByText("0/2")).toBeInTheDocument();
  expect(document.querySelector('input[name="genres"]')).toBeTruthy();
  expect(screen.getByLabelText("语言")).toBeInTheDocument();
  expect(screen.getByText("国语")).toBeInTheDocument();
  expect(document.querySelector('input[name="languages"]')).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "封面图片" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/封面/)).not.toBeInTheDocument();
  expect(document.querySelector('input[name="cover_url"]')).toBeNull();
  // 隐藏字段提交人物 ID（ChoicePicker 按 ID\\t姓名）
  const artists = document.querySelector('input[name="artists"]') as HTMLInputElement;
  expect(artists.value).toContain("p1\t周杰伦");
  const lyricists = document.querySelector('input[name="lyricists"]') as HTMLInputElement;
  expect(lyricists.value).toContain("p2\t方文山");
});

it("编辑曲目时盘号显示已有值，不为空也不强制成 1", () => {
  render(
    <MediaForm
      initialType="music"
      lockType
      parent={{ id: "a1", name: "叶惠美", type: "album", detail: "专辑", cover_url: null }}
      item={{
        id: "t6",
        type: "music",
        title: "第二碟曲目",
        ...blank,
        parent_id: "a1",
        number: 1,
        disc_number: 2,
        artists: [{ id: "p1", name: "周杰伦", alternate_name: null }],
      }}
    />,
  );
  expect(screen.getByLabelText("盘号")).toHaveValue(2);
});

it("专辑删除提示包含下属曲目数量", () => {
  render(
    <MediaForm
      initialType="album"
      lockType
      impact={{ seasons: 0, episodes: 0, tracks: 11 }}
      item={{ id: "a1", type: "album", title: "叶惠美", ...blank }}
    />,
  );
  expect(screen.getAllByText(/本次还会删除 11 首曲目/).length).toBeGreaterThan(0);
});

it("albumCoverPreviewSrc 校验通过后返回规范化 href，拒绝危险或不在白名单的地址", () => {
  const itunes = "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg";
  expect(albumCoverPreviewSrc(`  ${itunes}  `)).toBe(new URL(itunes).href);
  expect(albumCoverPreviewSrc("https://coverartarchive.org/release/x/front-500")).toBe(
    "https://coverartarchive.org/release/x/front-500",
  );
  expect(albumCoverPreviewSrc("https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg")).toContain(
    "covers.openlibrary.org",
  );
  expect(
    albumCoverPreviewSrc("https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1"),
  ).toContain("books.google.com");
  expect(albumCoverPreviewSrc("https://image.tmdb.org/t/p/original/a.jpg")).toBe(
    "https://image.tmdb.org/t/p/original/a.jpg",
  );
  expect(albumCoverPreviewSrc("javascript:alert(1)")).toBeNull();
  expect(albumCoverPreviewSrc("https://evil.example/cover.jpg")).toBeNull();
  expect(albumCoverPreviewSrc("https://user:pass@is1-ssl.mzstatic.com/cover.jpg")).toBeNull();
  expect(albumCoverPreviewSrc("https://is1-ssl.mzstatic.com:8443/cover.jpg")).toBeNull();
  expect(albumCoverPreviewSrc("http://is1-ssl.mzstatic.com/cover.jpg")).toBeNull();
  expect(albumCoverPreviewSrc("")).toBeNull();
});

it("专辑封面预览使用规范化后的白名单 URL，不渲染非法地址", () => {
  render(
    <MediaForm
      initialType="album"
      lockType
      item={{
        id: "a1",
        type: "album",
        title: "叶惠美",
        ...blank,
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg",
      }}
    />,
  );
  expect(screen.getByRole("img", { name: "封面预览" })).toHaveAttribute(
    "src",
    "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg",
  );
  const cover = screen.getByLabelText("封面图片 URL");
  fireEvent.change(cover, { target: { value: "javascript:alert(1)" } });
  expect(screen.queryByRole("img", { name: "封面预览" })).not.toBeInTheDocument();
  fireEvent.change(cover, { target: { value: "https://evil.example/a.jpg" } });
  expect(screen.queryByRole("img", { name: "封面预览" })).not.toBeInTheDocument();
});
