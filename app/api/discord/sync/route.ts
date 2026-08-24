// app/api/discord/sync/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const botToken = process.env.DISCORD_TOKEN;
    const genGuildId = '151119943943428258';
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

    // 1. GENサーバーのメンバーを取得・同期
    const resGen = await fetch(`https://discord.com/api/v10/guilds/${genGuildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (resGen.ok) {
      const genMembers = await resGen.json();
      for (const member of genMembers) {
        if (member.user.bot) continue;
        const discordId = member.user.id;
        const displayName = member.nick || member.user.global_name || member.user.username;

        const { data: existing } = await supabase
          .from('members')
          .select('discord_id, is_in_2275')
          .eq('discord_id', discordId)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from('members').insert([
            {
              discord_id: discordId,
              name: displayName,
              status: 'active',
              rank_role: 'R1',
              updated_at: new Date().toISOString(),
            },
          ]);
          if (!error) updatedCount++;
        }
      }
    }

    // 2. 2275サーバーのメンバーを取得・同期 (is_in_2275フラグを立てる)
    const res2275 = await fetch(`https://discord.com/api/v10/guilds/${guild2275Id}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (res2275.ok) {
      const members2275 = await res2275.json();
      for (const member of members2275) {
        if (member.user.bot) continue;
        const discordId = member.user.id;
        const displayName = member.nick || member.user.global_name || member.user.username;

        const { data: existing } = await supabase
          .from('members')
          .select('discord_id')
          .eq('discord_id', discordId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('members')
            .update({ is_in_2275: true })
            .eq('discord_id', discordId);
        } else {
          const { error } = await supabase.from('members').insert([
            {
              discord_id: discordId,
              name: displayName,
              status: 'active',
              rank_role: 'R1',
              is_in_2275: true,
              updated_at: new Date().toISOString(),
            },
          ]);
          if (!error) updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message || '内部サーバーエラーが発生しました' }, { status: 500 });
  }
}