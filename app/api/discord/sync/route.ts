// app/api/discord/sync/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const botToken = process.env.DISCORD_TOKEN;
    const genGuildId = '1511199443943428258';
    const guild2275Id = '1500099590018437140';

    if (!botToken) {
      return NextResponse.json(
        { error: 'Discordのトークン (DISCORD_TOKEN) が設定されていません。' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let updatedCount = 0;

    // 1. GENサーバーのメンバーを取得
    const resGen = await fetch(`https://discord.com/api/v10/guilds/${genGuildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    const genMembersMap = new Map();
    if (resGen.ok) {
      const genMembers = await resGen.json();
      for (const m of genMembers) {
        if (m.user.bot) continue;
        genMembersMap.set(m.user.id, m);
      }
    }

    // 2. 2275サーバーのメンバーを取得
    const res2275 = await fetch(`https://discord.com/api/v10/guilds/${guild2275Id}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    const members2275Map = new Map();
    if (res2275.ok) {
      const members2275 = await res2275.json();
      for (const m of members2275) {
        if (m.user.bot) continue;
        members2275Map.set(m.user.id, m);
      }
    }

    // 両サーバーの全ユニークなDiscord IDを抽出
    const allDiscordIds = new Set([
      ...genMembersMap.keys(),
      ...members2275Map.keys(),
    ]);

    // Supabaseから既存データを一括取得
    const { data: existingMembers } = await supabase.from('members').select('*');
    const existingMap = new Map();
    if (existingMembers) {
      existingMembers.forEach((em) => existingMap.set(em.discord_id, em));
    }

    const nowIso = new Date().toISOString();

    for (const discordId of allDiscordIds) {
      const genMember = genMembersMap.get(discordId);
      const member2275 = members2275Map.get(discordId);
      const existing = existingMap.get(discordId);

      const isInGen = !!genMember;
      const isIn2275 = !!member2275;

      // 表示名の決定（GEN優先、なければ2275）
      const targetMember = genMember || member2275;
      const displayName = targetMember?.nick || targetMember?.user?.global_name || targetMember?.user?.username || 'Unknown';

      if (!existing) {
        // ① discord_idが存在していないとき：新規登録
        const { error: insertError } = await supabase.from('members').insert([
          {
            discord_id: discordId,
            name: displayName,
            status: 'active',
            rank_role: 'R1',
            gen_discord: isInGen,
            is_in_2275: isIn2275,
            updated_at: nowIso,
          },
        ]);
        if (!insertError) {
          updatedCount++;
        } else {
          console.error('Insert Error for ID:', discordId, insertError);
        }
      } else {
        // ② discord_idが存在しているとき：差分がある場合のみ更新
        const hasChanged =
          existing.gen_discord !== isInGen ||
          existing.is_in_2275 !== isIn2275 ||
          existing.name !== displayName;

        if (hasChanged) {
          const { error: updateError } = await supabase
            .from('members')
            .update({
              gen_discord: isInGen,
              is_in_2275: isIn2275,
              name: displayName,
              updated_at: nowIso,
            })
            .eq('discord_id', discordId);

          if (!updateError) {
            updatedCount++;
          } else {
            console.error('Update Error for ID:', discordId, updateError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message || '内部サーバーエラーが発生しました' }, { status: 500 });
  }
}