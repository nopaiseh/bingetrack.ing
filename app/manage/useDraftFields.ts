"use client";
import { useState, type ChangeEvent } from "react";
/** 受控字段不会被表单 Action 的自动重置清空，失败后可直接修正重试。 */
export function useDraftFields() {
  const [values, setValues] = useState<Record<string, string>>({});
  const field = (name: string, initial?: string | number | null) => ({
    value: values[name] ?? String(initial ?? ""),
    onChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
      const value = event.target.value;
      setValues(previous => ({ ...previous, [name]: value }));
    },
  });
  return Object.assign(field, { reset: () => setValues({}) });
}
