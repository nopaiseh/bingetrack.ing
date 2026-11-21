"use client";

import ChoicePicker from "../../ChoicePicker";
import type { MediaInput } from "@/lib/admin/media-form";

/** 图书作者区块。 */
export function BookAuthorsSection({ item, resetKey }: { item?: MediaInput; resetKey: number }) {
  return (
    <section className="edit-card edit-cast-card" aria-labelledby="edit-authors-heading">
      <header className="edit-card-head">
        <div>
          <h2 id="edit-authors-heading">作者</h2>
          <p className="edit-hint">通过人物选择器添加；无译者字段。提交时带人物 ID。</p>
        </div>
      </header>
      <ChoicePicker
        key={`${resetKey}-authors`}
        kind="people"
        name="authors"
        label="作者"
        allowCreate
        sortable
        rows
        initial={(item?.authors ?? []).map((person) => ({
          id: person.id ?? `new:${person.name}`,
          name: person.name,
          detail: person.alternate_name ?? undefined,
        }))}
      />
    </section>
  );
}
