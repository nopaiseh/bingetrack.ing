export type Media = {
  id: string;
  title: string;
  date: string;
  rating: number | null;
  genres: string[];
  languages: string[];
  regions?: string[];
  series?: string | null;
  status?: string;
  summary?: string;
  cover_url: string;
  casts?: string[];
  directors?: string[];
  seriesMovie?: Media[];
};