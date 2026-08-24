// app/role_master/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AuthGuard from '@/components/AuthGuard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RoleItem {
  web_role: string;
  role_name: string;
}

interface PageItem {
  path: string;
  page_name: string;
  display_order: number | null;
}

interface PermissionItem {
  web_role: string;
  path: string;
}

function RoleMasterContent() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const savedGameId = localStorage.getItem('logged_in_game_id');
      let currentRole = 'member';

      if (savedGameId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('web_role')
          .eq('game_id', savedGameId)
          .maybeSingle();
        if (profile?.web_role) {
          currentRole = profile.web_role;
        }
      }

      if (currentRole !== 'master' && currentRole !== 'admin') {
        setIsMaster(false);
        setLoading(false);
        return;
      }

      setIsMaster(true);

      // 1. roles テーブルからロール一覧を取得
      const { data: roleData } = await supabase
        .from('roles')
        .select('web_role, role_name')
        .order('display_order', { ascending: true });

      if (roleData) setRoles(roleData);

      // 2. page_list テーブルからページ一覧を取得（display_order順）
      const { data: pageData } = await supabase
        .from('page_list')
        .select('path, page_name, display_order')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });

      if (pageData) setPages(pageData);

      // 3. role_permissions から現在の権限設定を取得
      const { data: permData } = await supabase
        .from('role_permissions')
        .select('web_role, path');

      if (permData) setPermissions(permData);

    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // チェックボックス切替時（pathをキーとして role_permissions を更新）
  const handleToggle = async (web_role: string, path: string, currentHasAccess: boolean) => {
    // 1. 画面の表示を即座に切り替え（楽観的UI）
    if (currentHasAccess) {
      setPermissions(prev => prev.filter(p => !(p.web_role === web_role && p.path === path)));
    } else {
      setPermissions(prev => [...prev, { web_role, path }]);
    }

    // 2. 裏でSupabaseのデータを更新
    if (currentHasAccess) {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .match({ web_role, path });
      if (error) {
        alert('変更の保存に失敗しました: ' + error.message);
        fetchData(); // 失敗した場合は再取得して復元
      }
    } else {
      const { error } = await supabase
        .from('role_permissions')
        .insert([{ web_role, path }]);
      if (error) {
        alert('変更の保存に失敗しました: ' + error.message);
        fetchData(); // 失敗した場合は再取得して復元
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">権限を確認中...</p>
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-[#151c2c] border border-red-500/30 p-8 rounded-2xl text-center space-y-3">
          <h1 className="text-xl font-bold text-red-400">⛔ アクセス権限がありません</h1>
          <p className="text-sm text-slate-400">この画面は最高権限を持つユーザーのみ閲覧できます。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col">
      <main className="flex-1 max-w-[1400px] mx-auto p-6 w-full space-y-6 flex flex-col">
        <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl shrink-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">⚙️ ロール別ページアクセス権限設定</h1>
          <p className="text-sm text-slate-400 mt-1">ロールごとにどの機能・ページにアクセスできるかを設定できます。</p>
        </div>

        {/* スクロール可能なテーブルコンテナ（ヘッダー固定） */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-250px)] border border-slate-800 rounded-xl bg-[#151c2c] shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1e293b] text-slate-300 uppercase sticky top-0 z-10 border-b border-slate-800 shadow-md">
              <tr>
                <th className="p-3.5 bg-[#1e293b]">機能 / パスグループ</th>
                {roles.map((r) => (
                  <th key={r.web_role} className="p-3.5 text-center font-mono text-cyan-400 bg-[#1e293b]">
                    {r.role_name}<br />
                    <span className="text-[10px] text-slate-500">({r.web_role})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pages.map((page) => (
                <tr key={page.path} className="hover:bg-slate-800/50 transition">
                  <td className="p-3.5">
                    <div className="font-medium text-white">{page.page_name}</div>
                    <div className="font-mono text-slate-500 text-[10px]">{page.path}</div>
                  </td>
                  {roles.map((r) => {
                    const roleKey = r.web_role;
                    const hasAccess = permissions.some((p) => p.web_role === roleKey && (p.path === '*' || p.path === page.path));
                    
                    const isMasterRole = roleKey === 'master';
                    const isAdminRole = roleKey === 'admin';
                    
                    const isRoleMasterPage = page.path === '/role_master';
                    
                    // ホーム ('/') と アンケート回答 ('/answer') は全ロール共通で常時アクセス許可＆グレーアウト
                    const isAlwaysAllowedPage = page.path === '/' || page.path === '/answer';

                    // デフォルトのチェック状態と有効/無効
                    let isChecked = hasAccess;
                    let isDisabled = false;

                    if (isMasterRole) {
                      isChecked = true;
                      isDisabled = true;
                    } else if (isAlwaysAllowedPage) {
                      isChecked = true;
                      isDisabled = true;
                    } else if (isRoleMasterPage) {
                      isChecked = false;
                      isDisabled = true;
                    } else if (isAdminRole) {
                      const isAdminAllowed = page.path === '/' || page.path === '/answer' || page.path === '/roles';
                      isChecked = isAdminAllowed;
                      isDisabled = true;
                    }

                    return (
                      <td key={roleKey} className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => handleToggle(roleKey, page.path, hasAccess)}
                          className="w-4 h-4 accent-cyan-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
