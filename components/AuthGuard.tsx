// components/AuthGuard.tsx
'use client';

import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [activeRoles, setActiveRoles] = useState<string[]>(['member']);
  const [userRoleForNav, setUserRoleForNav] = useState('member');

  const [gameIdInput, setGameIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkAuth = async (currentPath: string) => {
    try {
      if (currentPath === '/login' || currentPath.startsWith('/login/')) {
        window.location.replace('/');
        return;
      }

      const savedGameId = localStorage.getItem('logged_in_game_id');
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUser = session?.user || null;

      if (!savedGameId && !supabaseUser) {
        setIsLoggedIn(false);
        setHasPermission(false);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);
      let profileData = null;

      if (savedGameId) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('game_id', savedGameId)
          .single();
        profileData = data;
      } else if (supabaseUser) {
        const providerId = supabaseUser.user_metadata?.sub || supabaseUser.identities?.[0]?.id;
        if (providerId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('discord_id', String(providerId))
            .single();
          profileData = data;
        }
        if (!profileData) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();
          profileData = data;
        }
      }

      if (profileData && profileData.status === 'left') {
        localStorage.removeItem('logged_in_game_id');
        supabase.auth.signOut();
        setIsLoggedIn(false);
        setHasPermission(false);
        setLoading(false);
        return;
      }

      if (profileData && profileData.game_id && !savedGameId) {
        localStorage.setItem('logged_in_game_id', profileData.game_id);
      }

      // 複数ロールの判定（独立したif文ですべてのフラグを収集）
      const currentActiveRoles: string[] = ['member'];

      if (profileData) {
        if (profileData.is_master) currentActiveRoles.push('master');
        if (profileData.is_admin) currentActiveRoles.push('admin');
        if (profileData.is_strategy) currentActiveRoles.push('strategy');
        if (profileData.is_transfer) currentActiveRoles.push('transfer');
        if (profileData.is_member_manager) currentActiveRoles.push('member_manager');
        if (profileData.is_reserve_master) currentActiveRoles.push('reserve_master');
        if (profileData.is_r4) currentActiveRoles.push('r4');
        if (profileData.is_gen_manage) currentActiveRoles.push('gen_manage');
        if (profileData.is_priority_reserve) currentActiveRoles.push('priority_reserve');
      }

      setActiveRoles(currentActiveRoles);

      // ナビゲーション表示用の代表ロール選定（上位権限を優先）
      let determinedRole = 'member';
      if (currentActiveRoles.includes('master')) determinedRole = 'master';
      else if (currentActiveRoles.includes('admin')) determinedRole = 'admin';
      else if (currentActiveRoles.includes('strategy')) determinedRole = 'strategy';
      else if (currentActiveRoles.includes('transfer')) determinedRole = 'transfer';
      else if (currentActiveRoles.includes('member_manager')) determinedRole = 'member_manager';
      else if (currentActiveRoles.includes('reserve_master')) determinedRole = 'reserve_master';
      else if (currentActiveRoles.includes('r4')) determinedRole = 'r4';
      else if (currentActiveRoles.includes('gen_manage')) determinedRole = 'gen_manage';
      else if (currentActiveRoles.includes('priority_reserve')) determinedRole = 'priority_reserve';

      setUserRoleForNav(determinedRole);

      if (currentActiveRoles.includes('master')) {
        setHasPermission(true);
        setLoading(false);
        return;
      }

      // 持っているすべてのロールに紐づく許可パスを一括取得
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('path')
        .in('web_role', currentActiveRoles);

      const allowedPaths = rolePerms?.map((p) => p.path) || [];
      const isAllowed = 
        allowedPaths.includes('*') ||
        allowedPaths.some((p) => {
          if (p === '/') return currentPath === '/';
          return currentPath === p || currentPath.startsWith(p + '/');
        });

      setHasPermission(isAllowed);
    } catch (err) {
      console.error('認証チェックエラー:', err);
      setIsLoggedIn(false);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    checkAuth(pathname);
  }, [pathname]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('game_id', gameIdInput)
        .single();

      if (error || !data) throw new Error('ゲームIDが見つかりません');
      if (data.status === 'left') throw new Error('このアカウントは退会済みです');
      if (data.password && data.password !== passwordInput) throw new Error('パスワードが違います');

      localStorage.setItem('logged_in_game_id', gameIdInput);
      setLoading(true);
      await checkAuth(window.location.pathname);
    } catch (err: any) {
      setErrorMsg(err.message || 'ログインに失敗しました');
      setLoading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscordLogin = async () => {
    setErrorMsg('');
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Discordログインに失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">認証情報を確認中...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6">
          <h1 className="text-xl font-bold text-center text-white">ログイン</h1>

          {errorMsg && (
            <div className="bg-rose-500/25 border border-rose-500/50 text-rose-300 p-3 rounded-lg text-xs break-all">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">ゲームID</label>
              <input
                type="text"
                required
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="ゲームIDを入力"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">パスワード</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="パスワードを入力"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-sm transition shadow disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#151c2c] px-2 text-slate-500">または</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDiscordLogin}
            className="w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium text-sm transition shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            Discordでログイン
          </button>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-md p-8 text-center space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-rose-400">アクセス権限がありません</h1>
          <p className="text-sm text-slate-400">
            このページを閲覧する権限がないか、ロールの設定を確認してください。
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('logged_in_game_id');
              supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition cursor-pointer"
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-screen">
      <Navigation userRoles={activeRoles} userRole={userRoleForNav} />
      {children}
    </div>
  );
}