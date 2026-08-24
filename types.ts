// types.ts
export type Member = {
  discord_id: string | null;
  name: string;
  rank_role: string | null;
  
  // 兵士Lv
  shield_soldier: string | null;
  spear_soldier: string | null;
  bow_soldier: string | null;

  game_id?: string | null;
  power_before_migration?: string | number | null;
  current_power?: string | number | null;
  transfer?: string | null;
  bear?: string | null;
  state?: string | null;

  gen_discord?: boolean | string | null;
  is_in_2275?: boolean | string | null;
  info_sharing?: boolean | string | null;
  updated_at: string;
  is_hidden?: boolean;

  // 新規追加項目
  leader?: boolean | null;
  alliance?: string | null;
  fc_level?: string | null;
  planet?: number | null;
  gareth_2?: number | null;
  gareth_3?: number | null;
  gareth_4?: number | null;
  
  // 英雄所持フラグ
  hero_hendrik?: boolean | null;
  hero_gatto?: boolean | null;
  hero_gordon?: boolean | null;
  hero_muming?: boolean | null;
  hero_renee?: boolean | null;
  hero_norah?: boolean | null;
  hero_mia?: boolean | null;
  hero_phily?: boolean | null;
  hero_zinman?: boolean | null;
};

export type SortKey = keyof Member | 'gen_discord_str';

export type EventItem = {
  id: string;
  event_type: string;
  title: string;
  event_date: string;
  display_order?: number;
};

export type EventResponseMap = {
  [eventId: string]: {
    [discordId: string]: string;
  };
};