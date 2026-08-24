// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const [gameId, setGameId] = useState('');
  const [password, setPassword] = useState('');

  // 1. ゲームID ＋ パスワードでのログイン処理
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (error || !data) {
        throw new Error('ゲームIDが見つかりません');
      }

      // ログイン成功時のルーティング
      router.push('/members');
    } catch (err: any) {
      setErrorMsg(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Discordでログイン処理（仮）
  const handleDiscordLogin = () => {
    alert('Discordログイン処理をここに実装します');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6">
        <h1 className="text-xl font-bold text-center text-white">ログイン</h1>

        {errorMsg && (
          <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 p-3 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">ゲームID</label>
            <input
              type="text"
              required
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
              placeholder="ゲームIDを入力"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
              placeholder="パスワードを入力"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-sm transition shadow disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        {/* 境界線 */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#151c2c] px-2 text-slate-500">または</span>
          </div>
        </div>

        {/* Discordでログインボタン */}
        <button
          type="button"
          onClick={handleDiscordLogin}
          className="w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium text-sm transition shadow flex items-center justify-center gap-2"
        >
          Discordでログイン
        </button>
      </div>
    </div>
  );
}