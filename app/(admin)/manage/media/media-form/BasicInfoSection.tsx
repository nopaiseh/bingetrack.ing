"use client";

import ChoicePicker from "../../ChoicePicker";
import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";
import type { ParentChoice } from "@/lib/admin/media-context";
import { DateField } from "./DateField";
import type { DraftField, DraftFields, TypeFlags } from "./types";

/** 基本信息卡片：公共标题／简介，以及按媒体类型显示的上级、编号、日期、时长、厂牌、出版社等字段。 */
export function BasicInfoSection({
  flags,
  item,
  parent,
  ancestorName,
  nextNumber,
  locked,
  resetKey,
  field,
  titleField,
  summaryField,
  runtimeField,
  runtimeHint,
  dateLabel,
  onTypeChange,
}: {
  flags: TypeFlags;
  item?: MediaInput;
  parent?: ParentChoice;
  ancestorName?: string | null;
  nextNumber?: number;
  locked: boolean;
  resetKey: number;
  field: DraftFields;
  titleField: DraftField;
  summaryField: DraftField;
  runtimeField: DraftField;
  runtimeHint: string | null;
  dateLabel: string;
  onTypeChange: (type: ManagedMediaType) => void;
}) {
  const { type, isMusicTrack, isAlbum, isBook, isChild, hasReleaseDate, hasRuntime, showTypeSelect } = flags;

  return (
    <section className="edit-card edit-basic" aria-labelledby="edit-basic-heading">
      <header className="edit-card-head">
        <h2 id="edit-basic-heading">基本信息</h2>
        <p className="edit-hint">
          {type === "tv_episode"
            ? "单集不设海报或剧照，公开页沿用节目海报"
            : isMusicTrack
              ? "曲目不设单独封面，公开页沿用专辑封面"
              : "显示在公开页面顶部"}
        </p>
      </header>
      {type === "tv_episode" ? (
        <p className="edit-note">已去掉图片输入。电影和电视节目仍可上传海报与剧照；单集只填文字资料。</p>
      ) : null}
      {isMusicTrack ? <p className="edit-note">曲序在同一专辑内不可重复；时长按整数秒填写，可留空。</p> : null}
      <div className="edit-fields">
        {type === "tv_episode" && ancestorName ? (
          <div className="span-3">
            <span className="edit-field-label" id="ancestor-label">
              所属节目
            </span>
            <div className="edit-locked-value" aria-labelledby="ancestor-label">
              <span className="truncate">{ancestorName}</span>
              <span className="edit-hint">锁定</span>
            </div>
          </div>
        ) : null}
        {isChild ? (
          <div className="span-3">
            <ChoicePicker
              key={`${resetKey}-${type}`}
              kind={type === "tv_season" ? "tv_show" : type === "tv_episode" ? "tv_season" : "album"}
              name="parent_id"
              label={type === "tv_season" ? "所属节目" : type === "tv_episode" ? "所属季" : "所属专辑"}
              multiple={false}
              required
              initial={
                parent &&
                parent.type === (type === "tv_season" ? "tv_show" : type === "tv_episode" ? "tv_season" : "album")
                  ? [parent]
                  : []
              }
            />
            {/* 加载时的所属专辑：RPC 仅在与新 parent 不同时删除该条 album_tracks，共用歌其它关联保留。 */}
            {isMusicTrack ? (
              <input type="hidden" name="previous_parent_id" value={item?.parent_id ?? parent?.id ?? ""} />
            ) : null}
          </div>
        ) : null}
        {isChild ? (
          <div className={type === "tv_episode" || isMusicTrack ? "span-2" : "span-3"}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="field-number">
                {type === "tv_season" ? "季编号（特别篇可填 0）" : type === "tv_episode" ? "集编号" : "曲序"}
              </label>
              <span className="edit-required">必填</span>
            </div>
            <input
              id="field-number"
              type="number"
              name="number"
              min="0"
              max="100000"
              step="1"
              {...field("number", item?.number ?? nextNumber)}
              required
              placeholder="1"
              className="font-mono"
              aria-describedby={isMusicTrack ? "field-number-hint" : undefined}
            />
            {isMusicTrack ? (
              <p id="field-number-hint" className="edit-hint mt-1">
                同一专辑内曲序不能重复；若已占用，保存时会提示更换。
              </p>
            ) : null}
          </div>
        ) : null}
        {isMusicTrack ? (
          <div className="span-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="field-disc-number">盘号</label>
            </div>
            <input
              id="field-disc-number"
              type="number"
              name="disc_number"
              min="1"
              max="100"
              step="1"
              {...field("disc_number", item?.disc_number)}
              placeholder="1"
              className="font-mono"
              aria-describedby="field-disc-number-hint"
            />
            <p id="field-disc-number-hint" className="edit-hint mt-1">
              多碟专辑用盘号区分；留空则保存时保留原盘号（新建默认 1）。
            </p>
          </div>
        ) : null}
        <div className={type === "tv_episode" ? "span-2" : "span-3"}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="field-title">中文标题</label>
            <span className="edit-required">必填</span>
          </div>
          <input id="field-title" name="title" {...titleField} maxLength={300} placeholder="作品名称" required />
        </div>
        <div className={type === "tv_episode" ? "span-2" : "span-3"}>
          <label htmlFor="field-alt-title" className="mb-1.5">
            原名 / 外文名
          </label>
          <input
            id="field-alt-title"
            name="alternate_title"
            {...field("alternate_title", item?.alternate_title)}
            maxLength={300}
            placeholder="可留空"
          />
        </div>
        {hasReleaseDate ? (
          <div className={showTypeSelect || hasRuntime ? "span-2" : "span-3"}>
            <label htmlFor="field-release-date" className="mb-1.5">
              {dateLabel}
            </label>
            <DateField
              id="field-release-date"
              label={dateLabel}
              value={field("release_date", item?.release_date).value}
              onChange={field("release_date", item?.release_date).onChange}
            />
          </div>
        ) : null}
        {hasRuntime ? (
          <div className={showTypeSelect ? "span-2" : "span-3"}>
            <label htmlFor="field-runtime" className="mb-1.5">
              {isMusicTrack ? "时长（秒）" : "片长"}
            </label>
            <div className="edit-runtime">
              <input
                id="field-runtime"
                type="number"
                name="runtime"
                min={isMusicTrack ? "1" : "0"}
                max={isMusicTrack ? "7200" : "100000"}
                step={isMusicTrack ? "1" : "any"}
                {...runtimeField}
                placeholder={isMusicTrack ? "秒，可留空" : "分钟"}
                className="font-mono"
                aria-describedby="field-runtime-hint"
              />
              <span id="field-runtime-hint" className="edit-hint">
                {runtimeHint ?? (isMusicTrack ? "1–7200 整数秒，可留空" : "单位为分钟")}
              </span>
            </div>
          </div>
        ) : null}
        {isAlbum ? (
          <div className="span-2">
            <label htmlFor="field-label" className="mb-1.5">
              厂牌
            </label>
            <input
              id="field-label"
              name="label"
              {...field("label", item?.label)}
              maxLength={200}
              placeholder="唱片公司，可留空"
            />
          </div>
        ) : null}
        {isBook ? (
          <>
            <div className="span-2">
              <label htmlFor="field-publisher" className="mb-1.5">
                出版社
              </label>
              <input
                id="field-publisher"
                name="publisher"
                {...field("publisher", item?.publisher)}
                maxLength={200}
                placeholder="可留空"
              />
            </div>
            <div className="span-2">
              <label htmlFor="field-isbn" className="mb-1.5">
                ISBN
              </label>
              <input
                id="field-isbn"
                name="isbn"
                {...field("isbn", item?.isbn)}
                maxLength={32}
                placeholder="10 或 13 位，可留空"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="field-isbn-hint"
              />
              <p id="field-isbn-hint" className="edit-hint mt-1">
                支持 ISBN-10 / ISBN-13，可带或不带连字符，示例 978-7-02-000220-7。
              </p>
            </div>
            <div className="span-2">
              <label htmlFor="field-page-count" className="mb-1.5">
                页数
              </label>
              <input
                id="field-page-count"
                type="number"
                name="page_count"
                min="1"
                max="20000"
                step="1"
                {...field("page_count", item?.page_count)}
                placeholder="1–20000，可留空"
                className="font-mono"
                aria-describedby="field-page-count-hint"
              />
              <p id="field-page-count-hint" className="edit-hint mt-1">
                只记录总页数，不跟踪阅读进度。
              </p>
            </div>
          </>
        ) : null}
        {showTypeSelect && locked ? (
          <div className="span-2">
            <label htmlFor="field-type-locked" className="mb-1.5">
              类型
            </label>
            <select id="field-type-locked" value={type} disabled aria-disabled="true">
              {Object.entries(mediaTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : showTypeSelect ? (
          <div className="span-2">
            <label htmlFor="media-type-select" className="mb-1.5">
              类型
            </label>
            <select
              id="media-type-select"
              name="type"
              value={type}
              onChange={(event) => onTypeChange(event.target.value as ManagedMediaType)}
            >
              {Object.entries(mediaTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="span-6">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="field-summary">简介</label>
            <span className="edit-hint">当前 {summaryField.value.length} 字</span>
          </div>
          <textarea
            id="field-summary"
            name="summary"
            rows={6}
            maxLength={20000}
            {...summaryField}
            placeholder="输入剧情梗概…"
          />
        </div>
      </div>
    </section>
  );
}
