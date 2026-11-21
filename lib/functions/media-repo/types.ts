/** 图书目录四项统计：总量、在读、读过、想读。 */
export type BookStats = {
  total: number;
  inProgress: number;
  watched: number;
  wantToWatch: number;
};

/** 专辑目录五项统计：专辑总量／已听／在听／想听，以及单曲（music）总量。 */
export type AlbumStats = {
  total: number;
  watched: number;
  watching: number;
  want: number;
  trackTotal: number;
};
