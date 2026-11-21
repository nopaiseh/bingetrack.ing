"use client";

import ChoicePicker from "../../ChoicePicker";
import type { MediaInput } from "@/lib/admin/media-form";
import type { DraftField, TypeFlags } from "./types";

/** 侧栏「发布」卡片：分类标签、观看／收听／阅读状态与评分。 */
export function PublishSection({
  flags,
  item,
  resetKey,
  ratingField,
  rated,
  activeScore,
  bookStatus,
  onBookStatus,
  onSetRating,
}: {
  flags: TypeFlags;
  item?: MediaInput;
  resetKey: number;
  ratingField: DraftField;
  rated: boolean;
  activeScore: number | null;
  bookStatus: "want_to_watch" | "in_progress" | "watched";
  onBookStatus: (value: "want_to_watch" | "in_progress" | "watched") => void;
  onSetRating: (value: string) => void;
}) {
  const { type, isMusicTrack, isAlbum, isBook, showFilmCast, hasRatingInput } = flags;

  return (
    <section className="edit-card edit-publish" aria-labelledby="edit-publish-heading">
      <header className="edit-card-head">
        <div>
          <h2 id="edit-publish-heading">发布</h2>
          <p className="edit-hint">
            {hasRatingInput
              ? isMusicTrack
                ? "本曲收听状态与评分"
                : isBook
                  ? "阅读状态与评分。会显示在公开页"
                  : type === "tv_episode"
                    ? "本集观看状态与评分"
                    : "分类标签与观看状态。会显示在公开页"
              : isAlbum
                ? "类型标签与由曲目汇总的收听状态"
                : "分类标签与由单集汇总的观看状态"}
          </p>
        </div>
      </header>
      {showFilmCast || isAlbum || isBook ? (
        <div className="edit-taxonomies">
          <ChoicePicker
            key={`${resetKey}-genres`}
            kind="genres"
            name="genres"
            label="类型标签"
            inline
            allowCreate
            initial={(item?.genres ?? []).map((value) => ({ id: value, name: value }))}
          />
          {showFilmCast ? (
            <>
              <ChoicePicker
                key={`${resetKey}-collections`}
                kind="collections"
                name="collections"
                label="系列"
                inline
                allowCreate
                initial={(item?.collections ?? []).map((value) => ({ id: value, name: value }))}
              />
              <ChoicePicker
                key={`${resetKey}-regions`}
                kind="regions"
                name="regions"
                label="地区"
                inline
                allowCreate
                initial={(item?.regions ?? []).map((value) => ({ id: value, name: value }))}
              />
              <ChoicePicker
                key={`${resetKey}-languages`}
                kind="languages"
                name="languages"
                label="语言"
                inline
                allowCreate
                initial={(item?.languages ?? []).map((value) => ({ id: value, name: value }))}
              />
            </>
          ) : isBook ? (
            <>
              <ChoicePicker
                key={`${resetKey}-collections`}
                kind="collections"
                name="collections"
                label="系列"
                inline
                allowCreate
                initial={(item?.collections ?? []).map((value) => ({ id: value, name: value }))}
              />
              <ChoicePicker
                key={`${resetKey}-languages`}
                kind="languages"
                name="languages"
                label="语言"
                inline
                allowCreate
                initial={(item?.languages ?? []).map((value) => ({ id: value, name: value }))}
              />
            </>
          ) : (
            <ChoicePicker
              key={`${resetKey}-collections`}
              kind="collections"
              name="collections"
              label="系列"
              inline
              allowCreate
              initial={(item?.collections ?? []).map((value) => ({ id: value, name: value }))}
            />
          )}
        </div>
      ) : null}
      {isBook ? (
        <div className="edit-watch">
          <input type="hidden" name="status" value={bookStatus} />
          <div className="edit-segment" role="group" aria-label="阅读状态">
            {(
              [
                ["want_to_watch", "想读"],
                ["in_progress", "在读"],
                ["watched", "读过"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="edit-segment-btn"
                aria-pressed={bookStatus === value}
                onClick={() => onBookStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mb-1.5 mt-4 flex items-center justify-between gap-2">
            <label htmlFor="field-rating">评分（0–10，可留空）</label>
            <span className="edit-hint font-mono">{rated ? `当前 ${ratingField.value}` : "未评分"}</span>
          </div>
          <input
            id="field-rating"
            type="number"
            name="rating"
            min="0"
            max="10"
            step="0.1"
            aria-describedby="field-rating-status"
            {...ratingField}
            placeholder="例如 8.5"
            className="font-mono"
          />
          <div className="edit-score-row">
            {Array.from({ length: 11 }, (_, score) => (
              <button
                key={score}
                type="button"
                className="edit-score"
                aria-pressed={activeScore === score}
                aria-label={`${score} 分`}
                onClick={() => onSetRating(String(score))}
              >
                {score}
              </button>
            ))}
          </div>
          <p id="field-rating-status" className="edit-hint">
            阅读状态可单独选择；评分可选。无页数进度字段。
          </p>
        </div>
      ) : hasRatingInput ? (
        <div className="edit-watch">
          <div className="edit-segment" role="group" aria-label={isMusicTrack ? "收听状态" : "观看状态"}>
            <button
              type="button"
              className="edit-segment-btn"
              aria-pressed={rated}
              onClick={() => document.getElementById("field-rating")?.focus()}
            >
              {isMusicTrack ? "听过" : "已看"}
            </button>
            <button type="button" className="edit-segment-btn" aria-pressed={!rated} onClick={() => onSetRating("")}>
              {isMusicTrack ? "没听过" : "未看"}
            </button>
          </div>
          <div className="mb-1.5 mt-4 flex items-center justify-between gap-2">
            <label htmlFor="field-rating">评分（0–10，可留空）</label>
            <span className="edit-hint font-mono">{rated ? `当前 ${ratingField.value}` : "未评分"}</span>
          </div>
          <input
            id="field-rating"
            type="number"
            name="rating"
            min="0"
            max="10"
            step="0.1"
            aria-describedby="field-rating-status"
            {...ratingField}
            placeholder="例如 8.5"
            className="font-mono"
          />
          <div className="edit-score-row">
            {Array.from({ length: 11 }, (_, score) => (
              <button
                key={score}
                type="button"
                className="edit-score"
                aria-pressed={activeScore === score}
                aria-label={`${score} 分`}
                onClick={() => onSetRating(String(score))}
              >
                {score}
              </button>
            ))}
          </div>
          <p id="field-rating-status" className="edit-hint">
            <span>{rated ? (isMusicTrack ? "听过" : "看过") : isMusicTrack ? "没听过" : "没看过"}</span>
            {rated
              ? isMusicTrack
                ? "已评分，保存为听过"
                : "已评分，保存为看过"
              : isMusicTrack
                ? "填写评分即标为听过"
                : "填写评分即标为看过"}
          </p>
        </div>
      ) : type === "tv_show" || type === "tv_season" || isAlbum ? (
        <div className="edit-watch">
          <div className="edit-segment" role="group" aria-label={isAlbum ? "收听状态" : "观看状态"}>
            {(
              [
                ["watched", isAlbum ? "听过" : "看过"],
                ["watching", isAlbum ? "在听" : "在看"],
                ["want_to_watch", isAlbum ? "没听过" : "没看过"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="edit-segment-btn"
                aria-pressed={(item?.status ?? "want_to_watch") === value}
                disabled
              >
                {label}
              </button>
            ))}
          </div>
          {item?.rating != null ? <p className="edit-hint font-mono">当前 {Number(item.rating).toFixed(1)}</p> : null}
          <p className="edit-hint">
            {isAlbum
              ? "专辑的收听状态由下属曲目自动汇总决定，不可在此直接删改。"
              : `${type === "tv_show" ? "电视节目" : "季"}的观看状态由下属单集自动汇总决定，不可在此直接删改。`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
