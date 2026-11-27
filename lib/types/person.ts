/**
 * `get_person_works` 返回形状（PR #296）加上人物表头字段。
 * people 表目前无头像列；`photo_url` 预留为 null，页头用字块占位。
 */

export type PersonWorkItem = {
  id: string;
  type: string;
  title: string;
  alternate_title: string | null;
  cover_url: string | null;
  release_date: string | null;
  character?: string | null;
  release_kind?: string | null;
};

export type PersonRoleGroup = {
  role: string;
  label: string;
  items: PersonWorkItem[];
};

export type PersonWorksPayload = {
  person_id: string;
  film_tv: PersonRoleGroup[];
  music: {
    albums: PersonRoleGroup[];
    songs: PersonRoleGroup[];
  };
  books: PersonRoleGroup[];
};

/** 公开人物页：RPC 作品 + people 行上的姓名。 */
export type PersonDetail = {
  id: string;
  name: string;
  alternate_name: string | null;
  /** 库中尚无头像；始终为 null，前端用 LetterTile。 */
  photo_url: string | null;
  works: PersonWorksPayload;
};
