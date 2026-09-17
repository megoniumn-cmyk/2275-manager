const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const GEN_GUILD_ID = '1511199443943428258';
const GUILD_2275_ID = '1500099590018437140';

if (!SUPABASE_URL || !SUPABASE_KEY || !DISCORD_BOT_TOKEN) {
  console.error('エラー: 必要な環境変数（SupabaseまたはDiscordのトークン）が設定されていません。');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const mapGenRoleToRankRole = (roles) => {
  for (const role of roles.values()) {
    if (role.name === 'R4以上') return 'R4以上';
    if (role.name === 'R3') return 'R3';
    if (role.name === 'R2') return 'R2';
    if (role.name === 'R1') return 'R1';
  }
  return null;
};

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}. Starting synchronization...`);

  try {
    const genGuild = await client.guilds.fetch(GEN_GUILD_ID);
    const guild2275 = await client.guilds.fetch(GUILD_2275_ID);

    // 両サーバーの全メンバーを取得（force: true でキャッシュをバイパスして最新を取得）
    const genMembers = await genGuild.members.fetch({ force: true });
    const members2275 = await guild2275.members.fetch({ force: true });

    const allDiscordIds = new Set([
      ...genMembers.keys(),
      ...members2275.keys(),
    ]);

    console.log(`GEN: ${genMembers.size} members, 2275: ${members2275.size} members (Total unique: ${allDiscordIds.size})`);

    // Supabaseから既存データを取得
    const { data: existingMembers, error: fetchError } = await supabase
      .from('members')
      .select('*');

    if (fetchError) throw fetchError;

    const existingMap = new Map();
    if (existingMembers) {
      existingMembers.forEach((m) => {
        if (m.discord_id) existingMap.set(String(m.discord_id), m);
      });
    }

    const nowIso = new Date().toISOString();
    const upsertRows = [];

    for (const discordId of allDiscordIds) {
      console.log(`チェック中のDiscord ID: ${discordId}`);

      const genMember = genMembers.get(discordId);
      const member2275 = members2275.get(discordId);
      const existing = existingMap.get(discordId);

      const isInGen = !!genMember;
      const isIn2275 = !!members2275.has(discordId);

      const gen_discord = isInGen;
      const is_in_2275 = isIn2275;

      // 役職判定（GEN優先）
      let rank_role = existing?.rank_role || null;
      if (isInGen && genMember) {
        const mappedRole = mapGenRoleToRankRole(genMember.roles.cache);
        if (mappedRole) rank_role = mappedRole;
      }

      // 名前の決定：ニックネームがあればそれを優先、なければユーザ名
      const targetMember = genMember || member2275;
      let discordName = 'Unknown';
      if (targetMember) {
        discordName = targetMember.nickname || targetMember.user.globalName || targetMember.user.username;
      }

      let name = existing?.name;
      if (!name || name.startsWith('no_discord')) {
        name = discordName;
      }

      if (!existing) {
        console.log(`【新規追加対象】ID: ${discordId}, 名前: ${name}`);
        upsertRows.push({
          discord_id: discordId,
          name: name,
          rank_role: rank_role,
          gen_discord: gen_discord,
          is_in_2275: is_in_2275,
          updated_at: nowIso,
        });
      } else {
        upsertRows.push({
          ...existing,
          name: name,
          rank_role: rank_role,
          gen_discord: gen_discord,
          is_in_2275: is_in_2275,
          updated_at: nowIso,
        });
      }
    }

    console.log(`Supabaseへ送信するデータ件数: ${upsertRows.length}件`);

    const { data: upsertData, error: upsertError } = await supabase
      .from('members')
      .upsert(upsertRows, { onConflict: 'discord_id' })
      .select();

    if (upsertError) {
      console.error('Supabase Upsert Error:', upsertError);
    } else {
      console.log(`Successfully synced ${upsertData ? upsertData.length : upsertRows.length} members to Supabase!`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed to sync discord members:', err);
    process.exit(1);
  }
});

client.login(DISCORD_BOT_TOKEN);