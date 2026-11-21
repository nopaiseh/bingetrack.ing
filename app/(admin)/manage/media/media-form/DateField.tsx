"use client";

import { useRef, type ChangeEvent } from "react";

export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="edit-date">
      <input
        id={id}
        name="release_date"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY-MM-DD"
        maxLength={10}
        pattern="\d{4}-\d{2}-\d{2}"
        spellCheck={false}
        className="font-mono"
        value={value}
        onChange={onChange}
        aria-describedby={`${id}-format`}
      />
      <button
        type="button"
        className="edit-icon"
        aria-label={`选择${label}`}
        onClick={() => picker.current?.showPicker?.()}
      >
        <span className="i-material-symbols-calendar-today-rounded size-5" aria-hidden="true" />
      </button>
      <input
        ref={picker}
        tabIndex={-1}
        aria-hidden="true"
        type="date"
        className="edit-date-native"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        onChange={onChange}
      />
      <p id={`${id}-format`} className="edit-hint">
        格式 YYYY-MM-DD
      </p>
    </div>
  );
}
