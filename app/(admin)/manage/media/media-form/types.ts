import type { ChangeEvent } from "react";
import type { ParentChoice } from "@/lib/admin/media-context";
import type { MediaInput, ManagedMediaType } from "@/lib/admin/media-form";

export type DraftField = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
};

export type DraftFields = ((name: string, initial?: string | number | null) => DraftField) & {
  reset: () => void;
};

export type MediaFormProps = {
  item?: MediaInput;
  initialType?: ManagedMediaType;
  lockType?: boolean;
  parent?: ParentChoice;
  ancestorName?: string | null;
  nextNumber?: number;
  impact?: { seasons: number; episodes: number; tracks?: number };
  publicHref?: string | null;
  publicLabel?: string;
  meta?: string | null;
};

export type TypeFlags = {
  type: ManagedMediaType;
  isTvChild: boolean;
  isMusicTrack: boolean;
  isAlbum: boolean;
  isBook: boolean;
  isChild: boolean;
  showCover: boolean;
  showFilmCast: boolean;
  showMusicPeople: boolean;
  hasReleaseDate: boolean;
  hasRuntime: boolean;
  hasRatingInput: boolean;
  showTypeSelect: boolean;
};
