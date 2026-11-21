"use client";

import ChoicePicker from "../../ChoicePicker";
import type { MediaInput } from "@/lib/admin/media-form";

/** 专辑／曲目的艺人与创作人员区块。 */
export function MusicPeopleSection({
  item,
  resetKey,
  isAlbum,
  isMusicTrack,
}: {
  item?: MediaInput;
  resetKey: number;
  isAlbum: boolean;
  isMusicTrack: boolean;
}) {
  return (
    <section className="edit-card edit-cast-card" aria-labelledby="edit-music-people-heading">
      <header className="edit-card-head">
        <div>
          <h2 id="edit-music-people-heading">{isAlbum ? "艺人" : "创作人员"}</h2>
          <p className="edit-hint">通过人物选择器添加；提交时带人物 ID，不会按姓名自动对应已有人物。</p>
        </div>
      </header>
      <ChoicePicker
        key={`${resetKey}-artists`}
        kind="people"
        name="artists"
        label={isAlbum ? "艺人" : "演唱艺人"}
        allowCreate
        sortable
        rows
        initial={(item?.artists ?? []).map((person) => ({
          id: person.id ?? `new:${person.name}`,
          name: person.name,
          detail: person.alternate_name ?? undefined,
        }))}
      />
      {isMusicTrack ? (
        <>
          <ChoicePicker
            key={`${resetKey}-lyricists`}
            kind="people"
            name="lyricists"
            label="作词"
            allowCreate
            sortable
            rows
            initial={(item?.lyricists ?? []).map((person) => ({
              id: person.id ?? `new:${person.name}`,
              name: person.name,
              detail: person.alternate_name ?? undefined,
            }))}
          />
          <ChoicePicker
            key={`${resetKey}-composers`}
            kind="people"
            name="composers"
            label="作曲"
            allowCreate
            sortable
            rows
            initial={(item?.composers ?? []).map((person) => ({
              id: person.id ?? `new:${person.name}`,
              name: person.name,
              detail: person.alternate_name ?? undefined,
            }))}
          />
        </>
      ) : null}
    </section>
  );
}
