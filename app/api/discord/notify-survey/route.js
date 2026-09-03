import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { surveyTitle, deadline, targets, surveyUrl } = body; 

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true, message: '通知対象者がいませんでした。' });
        }

        const botToken = process.env.DISCORD_TOKEN;
        const channelId = process.env.DISCORD_NOTIFICATION_CHANNEL_ID;

        if (!botToken || !channelId) {
            return NextResponse.json({ error: '環境変数が不足しています。' }, { status: 500 });
        }

        // 期限のフォーマット（JST ＆ UTC）
        let formattedDeadline = deadline;
        if (deadline) {
            try {
                const dateObj = new Date(deadline);
                
                // JST (Asia/Tokyo) のフォーマット
                const jstString = dateObj.toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: false
                }); // 例: "9/9 0:00"

                // UTC のフォーマット
                const utcString = dateObj.toLocaleString('ja-JP', {
                    timeZone: 'UTC',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: false
                }); // 例: "9/8 15:00"
                
                formattedDeadline = `${jstString} (JST) / ${utcString} (UTC)`;
            } catch (e) {
                console.error('Date format error:', e);
            }
        }

        // targets がオブジェクトの配列であっても、文字列であっても安全にDiscord IDを取り出す
        const mentions = targets.map((target) => {
            let discordId = '';
            if (typeof target === 'string' || typeof target === 'number') {
                discordId = String(target);
            } else if (target && typeof target === 'object') {
                discordId = target.discord_id || target.discordId || target.id || target.user_id || '';
            }
            return discordId ? `<@${discordId}>` : '';
        }).filter(Boolean).join(' ');

        // メッセージの組み立て
        const messageLines = [
            `📢 **アンケート未回答のお知らせ**`,
            ``,
            `アンケート「${surveyTitle}」の回答期限が近づいています（期限: ${formattedDeadline}）。`,
            `まだ回答していない方はご対応よろしくお願いします！`,
        ];

        if (surveyUrl) {
            messageLines.push(``, `🔗 回答URL: ${surveyUrl}`);
        }

        messageLines.push(``, mentions);

        const messageContent = messageLines.join('\n');

        const discordResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${botToken.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: messageContent,
            }),
        });

        const responseText = await discordResponse.text();

        if (!discordResponse.ok) {
            return NextResponse.json({ error: 'Discordへの通知送信に失敗しました。', details: responseText }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '未回答者への通知を送信しました！' });

    } catch (error) {
        console.error('API CATCH ERROR:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。', message: error.message }, { status: 500 });
    }
}