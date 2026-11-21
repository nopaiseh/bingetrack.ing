"use client";

import { useActionState } from "react";
import { confirmSuspiciousName } from "../report-actions";
import { ActionNotice } from "../StatusModal";

/** 报告行上的「确认无误」：样式与「不是同一人」相同。 */
export default function ConfirmSuspiciousName({ itemId, confirmedName }: { itemId: string; confirmedName: string }) {
  const [state, action, pending] = useActionState(confirmSuspiciousName, {});
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="confirmed_name" value={confirmedName} />
      <ActionNotice state={state} />
      <button type="submit" disabled={pending}>
        {pending ? "正在确认…" : "确认无误"}
      </button>
    </form>
  );
}
