// app/roles/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProfileItem {
  id: string;
  game_id: string;
  name: string;
  alliance: string;
  game_role: string;
  is_master: boolean;
  is_admin: boolean;
  is_strategy: boolean;
  is_transfer: boolean;
  is_member_manager: boolean;
  is_reserve_master: boolean;
  is_member: boolean;
  is_r4: boolean;
  is_gen_manage: boolean;
  is_priority_reserve: boolean;
}

interface RoleMeta {
  key: keyof ProfileItem;
  label: string;
}

// モーダルや通常の変更対象とするロール（マスターは除外）
const ROLE_LIST: RoleMeta[] = [
  { key: 'is_admin', label: '管理人' },
  { key: 'is_strategy', label: '戦略' },
  { key: 'is_transfer', label: '移民' },
  { key: 'is_member_manager', label: 'メンバー管理' },
  { key: 'is_reserve_master', label: '官職予約' },
  { key: 'is_r4', label: 'R4' },
  { key: 'is_gen_manage', label: 'GEN管理' },
  { key: 'is_priority_reserve', label: '官職優先予約者' },
];

export default function RolesPage() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<ProfileItem[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<ProfileItem | null>(null);
  const [modalRoles, setModalRoles] = useState<{ [key: string]: boolean }>({});

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true, nullsFirst: false });

      if (error) throw error;
      if (data) setProfiles(data);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // メンバー以外の何らかの権限（マスター含む）を持っている人
  const filteredProfiles = profiles.filter((p) => {
    const hasAnySpecialRole =
      p.is_master ||
      p.is_admin ||
      p.is_strategy ||
      p.is_transfer ||
      p.is_member_manager ||
      p.is_reserve_master ||
      p.is_r4 ||
      p.is_gen_manage ||
      p.is_priority_reserve;
    return hasAnySpecialRole;
  });

  // チェックボックス変更時の処理（テーブル内）
  const handleRoleToggle = async (id: string, roleKey: keyof ProfileItem, currentValue: boolean) => {
    const newValue = !currentValue;

    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [roleKey]: newValue } : p))
    );

    const { error } = await supabase
      .from('profiles')
      .update({ [roleKey]: newValue })
      .eq('id', id);

    if (error) {
      alert('権限の更新に失敗しました: ' + error.message);
      fetchProfiles();
    }
  };

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    setSelectedTargetUser(null);
    setSearchModalQuery('');
    setModalRoles({});
    if (allProfiles.length === 0) {
      const { data } = await supabase.from('profiles').select('*').order('name', { ascending: true });
      if (data) setAllProfiles(data);
    }
  };

  const searchModalResults = allProfiles.filter((p) => {
    if (!searchModalQuery.trim()) return false;
    const query = searchModalQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(query) || false;
    const gameIdMatch = p.game_id?.toLowerCase().includes(query) || false;
    return nameMatch || gameIdMatch;
  });

  const handleSelectUser = (user: ProfileItem) => {
    setSelectedTargetUser(user);
    const currentRolesState: { [key: string]: boolean } = {};
    ROLE_LIST.forEach((r) => {
      currentRolesState[r.key] = !!user[r.key];
    });
    setModalRoles(currentRolesState);
  };

  const handleModalRoleToggle = (key: string) => {
    setModalRoles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveModalRoles = async () => {
    if (!selectedTargetUser) return;

    const updatePayload: any = {};
    ROLE_LIST.forEach((r) => {
      updatePayload[r.key] = !!modalRoles[r.key];
    });

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', selectedTargetUser.id);

    if (error) {
      alert('権限の保存に失敗しました: ' + error.message);
      return;
    }

    alert('権限を更新しました！');
    setIsModalOpen(false);
    fetchProfiles();
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col h-screen overflow-hidden">
      <main className="flex-1 max-w-[1600px] mx-auto p-6 w-full space-y-6 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Web権限管理 (Web Roles)</h1>
            <p className="text-sm text-slate-400 mt-1">特殊権限を持つユーザーの一覧です。新しい権限の付与は右上のボタンから行えます。</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            + 新規ロール付与
          </button>
        </div>

        {/* テーブル表示部分（ヘッダー固定・中身だけスクロール） */}
        <div className="flex-1 border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl flex flex-col overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">データを読み込み中...</div>
          ) : (
            <div className="flex-1 overflow-auto relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1e293b] text-slate-300 uppercase sticky top-0 z-20 border-b border-slate-800 shadow-md">
                  <tr>
                    <th className="p-3.5 bg-[#1e293b] min-w-[140px]">ゲームアカウント名</th>
                    <th className="p-3.5 bg-[#1e293b] min-w-[110px]">GAME_ID</th>
                    <th className="p-3.5 bg-[#1e293b] min-w-[80px]">同盟名</th>
                    <th className="p-3.5 bg-[#1e293b] min-w-[90px]">ゲーム内ロール</th>
                    <th className="p-3.5 text-center bg-[#1e293b] min-w-[80px] text-purple-400">マスター</th>
                    {ROLE_LIST.map((role) => (
                      <th key={String(role.key)} className="p-3.5 text-center bg-[#1e293b] min-w-[80px]">
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={5 + ROLE_LIST.length} className="p-12 text-center text-slate-500">
                        特殊権限を持つユーザーがいません。「+ 新規ロール付与」から権限を設定してください。
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-medium text-white">{p.name || '(未設定)'}</td>
                        <td className="p-3.5 font-mono text-cyan-400">{p.game_id}</td>
                        <td className="p-3.5 text-slate-300">{p.alliance || '-'}</td>
                        <td className="p-3.5 text-slate-400">{p.game_role || '-'}</td>
                        
                        {/* マスター権限（グレーアウト固定・変更不可） */}
                        <td className="p-3.5 text-center bg-purple-500/5">
                          <input
                            type="checkbox"
                            checked={!!p.is_master}
                            disabled
                            className="w-4 h-4 accent-purple-500 opacity-50 cursor-not-allowed"
                            title="マスター権限はここから変更できません"
                          />
                        </td>

                        {/* その他の権限（変更可能） */}
                        {ROLE_LIST.map((role) => {
                          const isChecked = !!p[role.key];
                          return (
                            <td key={String(role.key)} className="p-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleRoleToggle(p.id, role.key, isChecked)}
                                className="w-4 h-4 accent-cyan-500 cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 新規ロール付与モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">新規ロール付与・検索</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 cursor-pointer"
              >
                ✕ 閉じる
              </button>
            </div>

            {!selectedTargetUser ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ユーザー検索 (名前 または game_id)
                  </label>
                  <input
                    type="text"
                    placeholder="例: 2929 または 365936581"
                    value={searchModalQuery}
                    onChange={(e) => setSearchModalQuery(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-[#0b0f19]">
                  {searchModalQuery.trim() === '' ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      検索ワードを入力してください
                    </div>
                  ) : searchModalResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      該当するユーザーが見つかりません
                    </div>
                  ) : (
                    searchModalResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="p-3 hover:bg-slate-800/60 flex justify-between items-center cursor-pointer border-b border-slate-800/50 last:border-none"
                      >
                        <div>
                          <div className="font-medium text-white text-sm">{user.name || '(未設定)'}</div>
                          <div className="font-mono text-cyan-400 text-xs">ID: {user.game_id}</div>
                        </div>
                        <div className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                          選択 ➔
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">選択中のユーザー</div>
                    <div className="text-base font-bold text-white">{selectedTargetUser.name}</div>
                    <div className="font-mono text-cyan-400 text-xs">ID: {selectedTargetUser.game_id}</div>
                  </div>
                  <button
                    onClick={() => setSelectedTargetUser(null)}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer"
                  >
                    別のユーザーを選ぶ
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-3">
                    付与・変更する権限を選択（マスター権限は除外）
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_LIST.map((role) => {
                      const isChecked = !!modalRoles[role.key];
                      return (
                        <label
                          key={String(role.key)}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-medium'
                              : 'border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleModalRoleToggle(String(role.key))}
                            className="w-4 h-4 accent-cyan-500 cursor-pointer"
                          />
                          {role.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveModalRoles}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow cursor-pointer"
                  >
                    保存する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}