'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  game_id: string | null;
  name: string | null;
  rank_role: string | null;
  discord_id: string | null;
  alliance: string | null;
  banned?: boolean | null;
  last_login_at?: string | null;
  password?: string | null;
};

type AllianceItem = {
  id: string;
  alliance: string;
  display_order: number;
};

const PRODUCTION_URL = 'https://wos2275-manager.vercel.app/';

export default function LoginCheckPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [alliances, setAlliances] = useState<AllianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // フィルター・検索用ステート
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlliance, setSelectedAlliance] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // データ取得
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // プロフィール一覧取得
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*');
        if (profileError) throw profileError;
        setProfiles(profileData || []);

        // 同盟リスト取得 (display_order順)
        const { data: allianceData, error: allianceError } = await supabase
          .from('alliance_list')
          .select('*')
          .order('display_order', { ascending: true });
        if (!allianceError && allianceData) {
          setAlliances(allianceData);
        }

      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 有効なDiscord連携かどうかを判定するヘルパー
  const hasValidDiscord = (discordId: string | null) => {
    if (!discordId) return false;
    if (discordId.startsWith('no_discord') || discordId.startsWith('temp')) {
      return false;
    }
    return true;
  };

  // ログイン履歴 / 連携状態の判定（bannedを最優先）
  const getLoginStatus = (p: Profile) => {
    if (p.banned) return { text: 'アクセス停止 (Banned)', type: 'banned' };

    const hasGameId = Boolean(p.game_id);
    const discordValid = hasValidDiscord(p.discord_id);
    const hasLoggedInTime = Boolean(p.last_login_at);

    if (hasLoggedInTime) return { text: 'ログイン記録あり', type: 'active' };
    if (hasGameId && discordValid) return { text: 'GameID / Discord 連携済み', type: 'both' };
    if (hasGameId) return { text: 'GameID 登録のみ', type: 'game_id' };
    if (discordValid) return { text: 'Discord 連携のみ', type: 'discord' };
    return { text: '未設定', type: 'none' };
  };

  // フィルタリング処理
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.game_id && p.game_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.alliance && p.alliance.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesAlliance = selectedAlliance === '' || p.alliance === selectedAlliance;

      const statusObj = getLoginStatus(p);
      const matchesStatus = selectedStatus === '' || statusObj.type === selectedStatus;

      return matchesSearch && matchesAlliance && matchesStatus;
    });
  }, [profiles, searchQuery, selectedAlliance, selectedStatus]);

  // コピー機能
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ログイン通知文章のコピー
  const handleCopyNotification = () => {
    const text = 
`【重要：Webサイトログインとアンケートご協力のお願い】
今後、イベント等のアンケートをこちらのWebサイト上で実施いたします。
お手数ですが、以下のURL・ゲームID・パスワードを用いてログインし、アクセスできるかご確認をお願いいたします。

■ ログインURL: ${PRODUCTION_URL}
■ ゲームID / パスワード: 各自のアカウント情報をご利用ください

--------------------------------------------------
[Important: Website Login & Survey Cooperation Request]
Surveys for upcoming events will be conducted on this website.
Please log in using the URL, Game ID, and Password below to check your access.

■ Login URL: ${PRODUCTION_URL}
■ Game ID / Password: Please use your respective account credentials.`;

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // URL単体コピー
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(PRODUCTION_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#0b0f19] p-8 text-center text-slate-400">
        データを読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0b0f19] text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">ログイン確認ページ</h1>

        {/* ヘッダーエリア */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#151c2c] border border-slate-800 p-4 rounded-xl shadow">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* 検索窓 */}
            <input
              type="text"
              placeholder="アカウント名、ゲームID、同盟で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 min-w-[240px]"
            />

            {/* 同盟プルダウン */}
            <select
              value={selectedAlliance}
              onChange={(e) => setSelectedAlliance(e.target.value)}
              className="bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">すべての同盟</option>
              {alliances.map((item) => (
                <option key={item.id} value={item.alliance}>{item.alliance}</option>
              ))}
            </select>

            {/* ログイン履歴 / 連携状態プルダウン */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#0b0f19] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">すべての状態</option>
              <option value="banned">アクセス停止 (Banned)</option>
              <option value="active">ログイン記録あり</option>
              <option value="both">GameID / Discord 連携済み</option>
              <option value="game_id">GameID 登録のみ</option>
              <option value="discord">Discord 連携のみ</option>
              <option value="none">未設定</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ログインステータス表示 */}
            <div className="text-sm text-slate-300">
              表示中: <span className="text-cyan-400 font-bold">{filteredProfiles.length}</span> / {profiles.length} 名
            </div>

            {/* URLコピーボタン */}
            <button
              onClick={handleCopyUrl}
              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer shadow"
            >
              {copiedUrl ? 'URLコピー完了！' : 'URLコピー'}
            </button>

            {/* ログイン通知文章コピーボタン */}
            <button
              onClick={handleCopyNotification}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer shadow"
            >
              {copiedNotification ? 'コピーしました！' : 'ログイン通知文章コピー'}
            </button>
          </div>
        </div>

        {/* テーブルエリア */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1b253b] text-slate-300 text-xs uppercase tracking-wider border-b border-slate-800">
                  <th className="p-4">アカウント名</th>
                  <th className="p-4">ゲームID</th>
                  <th className="p-4">同盟</th>
                  <th className="p-4">ログイン履歴 / 連携状態</th>
                  <th className="p-4">最終ログイン日時</th>
                  <th className="p-4 text-center">ゲームIDコピー</th>
                  <th className="p-4 text-center">パスワードコピー</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800 text-slate-200">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      該当するメンバーが見つかりません。
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => {
                    const status = getLoginStatus(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-4 font-medium text-white">{p.name || '未設定'}</td>
                        <td className="p-4 font-mono text-slate-400">{p.game_id || '-'}</td>
                        <td className="p-4 text-slate-300">{p.alliance || '-'}</td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            status.type === 'banned' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            status.type === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            status.type === 'both' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            status.type !== 'none' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-slate-700/50 text-slate-400'
                          }`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs">
                          {p.last_login_at ? new Date(p.last_login_at).toLocaleString('ja-JP') : '記録なし'}
                        </td>
                        <td className="p-4 text-center">
                          {p.game_id ? (
                            <button
                              onClick={() => handleCopy(p.game_id!, `id-${p.id}`)}
                              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer border border-slate-700"
                            >
                              {copiedId === `id-${p.id}` ? 'コピー完了!' : 'IDコピー'}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {p.password ? (
                            <button
                              onClick={() => handleCopy(p.password!, `pw-${p.id}`)}
                              className="bg-slate-800 hover:bg-slate-700 text-rose-400 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer border border-slate-700"
                            >
                              {copiedId === `pw-${p.id}` ? 'コピー完了!' : 'PWコピー'}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}