// components/AuthGuard.tsx
'use client';

import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [gameIdInput, setGameIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verifyAuthAndPermission = async () => {
    try {
      const savedGameId = localStorage.getItem('logged_in_game_id');
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUser = session?.user || null;

      if (!savedGameId && !supabaseUser) {
        setIsLoggedIn(false);
        setHasPermission(false);
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
        return;
      }

      if (profileData && profileData.game_id && !savedGameId) {
        localStorage.setItem('logged_in_game_id', profileData.game_id);
      }

      const activeRoles: string[] = ['member'];
      if (profileData) {
        if (profileData.is_master) activeRoles.push('master');
        if (profileData.is_admin) activeRoles.push('admin');
        if (profileData.is_strategy) activeRoles.push('strategy');
        if (profileData.is_transfer) activeRoles.push('transfer');
        if (profileData.is_member_manager) activeRoles.push('member_manager');
        if (profileData.is_reserve_master) activeRoles.push('reserve_master');
        if (profileData.is_r4) activeRoles.push('r4');
        if (profileData.is_gen_manage) activeRoles.push('gen_manage');
        if (profileData.is_priority_reserve) activeRoles.push('priority_reserve');
      }

      if (activeRoles.includes('master')) {
        setHasPermission(true);
        return;
      }

      const currentPath = window.location.pathname;
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('path')
        .in('web_role', activeRoles);

      const allowedPaths = rolePerms?.map((p) => p.path) || [];
      const isAllowed = 
        allowedPaths.includes('*') ||
        allowedPaths.some((p) => {
          if (p === '/') return currentPath === '/';
          return currentPath === p || currentPath.startsWith(p + '/');
        });

      setHasPermission(isAllowed);
    } catch (err) {
      console.error('権限確認エラー:', err);
      setIsLoggedIn(false);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    verifyAuthAndPermission();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        verifyAuthAndPermission();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
      
      // リロードせず直接状態を更新してダッシュボードを表示する（1回目リロード問題を解消）
      setIsLoggedIn(true);
      await verifyAuthAndPermission();
      setSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'ログインに失敗しました');
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_in_game_id');
    supabase.auth.signOut();
    setIsLoggedIn(false);
    setHasPermission(false);
    setGameIdInput('');
    setPasswordInput('');
  };

  // Discordログインをリダイレクト専用の通常リンク（または確実な遷移）に変更
  const handleDiscordLogin = async () => {
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Discordログインエラー:', err);
      setErrorMsg(err.message || 'Discordログインに失敗しました');
    }
  };

  if (isLoggedIn === null || (isLoggedIn && hasPermission === null)) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0b0f19] text-slate-100 flex items-center justify-center">
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

  if (hasPermission === false) {
    localStorage.removeItem('logged_in_game_id');
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-md p-8 text-center space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold text-rose-400">アクセス権限がありません</h1>
          <p className="text-sm text-slate-400">
            このページを閲覧する権限がないか、セッションが無効です。
          </p>
          <button
            onClick={() => {
              localStorage.clear();
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

  return <>{children}</>;
}