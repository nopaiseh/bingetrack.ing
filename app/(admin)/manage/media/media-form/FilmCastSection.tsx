"use client";

import ChoicePicker from "../../ChoicePicker";
import type { MediaInput } from "@/lib/admin/media-form";

/** 电影／电视节目的演职员区块。 */
export function FilmCastSection({ item, resetKey }: { item?: MediaInput; resetKey: number }) {
  return (
    <section className="edit-card edit-cast-card" aria-labelledby="edit-cast-heading">
      <header className="edit-card-head">
        <div>
          <h2 id="edit-cast-heading">演职员</h2>
          <p className="edit-hint">拖动左侧手柄排序。键盘可用上移、下移按钮。</p>
        </div>
      </header>
      <ChoicePicker
        key={`${resetKey}-directors`}
        kind="people"
        name="directors"
        label="导演"
        inline
        allowCreate
        initial={(item?.directors ?? []).map((person) => ({
          id: person.id ?? `new:${person.name}`,
          name: person.name,
          detail: person.alternate_name ?? undefined,
        }))}
      />
      <ChoicePicker
        key={`${resetKey}-actors`}
        kind="people"
        name="actors"
        label="演员"
        allowCreate
        sortable
        withCharacter
        rows
        initial={(item?.actors ?? []).map((person) => ({
          id: person.id ?? `new:${person.name}`,
          name: person.name,
          detail: person.alternate_name ?? undefined,
          character: person.character,
        }))}
      />
    </section>
  );
}
