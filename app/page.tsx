// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageItem {
  path: string;
  page_name: string;
  note: string | null;
  display_order: number;
  open: boolean;
  manage: boolean;
}

export default function HomePage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPages = async () => {
      try {
        const savedGameId = localStorage.getItem('logged_in_game_id');
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUser = session?.user || null;

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

        const roles: string[] = [];
        if (profileData) {
          if (profileData.is_master) roles.push('master');
          if (profileData.is_admin) roles.push('admin');
          if (profileData.is_strategy) roles.push('strategy');
          if (profileData.is_transfer) roles.push('transfer');
          if (profileData.is_member_manager) roles.push('member_manager');
          if (profileData.is_reserve_master) roles.push('reserve_master');
          if (profileData.is_member) roles.push('member');
          if (profileData.is_r4) roles.push('r4');
          if (profileData.is_gen_manage) roles.push('gen_manage');
          if (profileData.is_priority_reserve) roles.push('priority_reserve');
        }

        if (roles.length === 0) roles.push('member');
        const isMaster = roles.includes('master');

        // 許可されたパスの取得
        let allowedPaths: string[] = [];
        if (isMaster) {
          allowedPaths = ['*'];
        } else if (roles.length > 0) {
          const { data: permData } = await supabase
            .from('role_permissions')
            .select('path')
            .in('web_role', roles);

          if (permData) {
            allowedPaths = permData.map((p) => p.path);
          }
        }

        // page_list から open = TRUE のものを取得
        const { data: pageData } = await supabase
          .from('page_list')
          .select('*')
          .eq('open', true)
          .order('display_order', { ascending: true });

        if (pageData) {
          // ホーム画面（'/'）を除外し、権限があるものだけに絞り込む
          const filtered = pageData.filter((page) => {
            if (page.path === '/') return false; // ホーム自身はカードグリッドから除外
            return isMaster || allowedPaths.includes('*') || allowedPaths.includes(page.path);
          });
          setPages(filtered);
        }
      } catch (err) {
        console.error('ホーム画面のデータ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPages();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* トップのウェルカムバナー */}
        <section className="bg-[#151c2c] border border-slate-800/80 rounded-2xl p-8 text-center shadow-xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            2275 MANAGER
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            同盟管理システムへようこそ
          </p>
        </section>

        {/* 権限のあるページ一覧カードグリッド */}
        <section>
          {loading ? (
            <div className="text-center py-12 text-slate-500">読み込み中...</div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-[#151c2c]/50 rounded-xl border border-slate-800">
              アクセス可能なページがありません。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pages.map((page) => (
                <Link
                  key={page.path}
                  href={page.path}
                  className="group bg-[#151c2c] hover:bg-[#1b2438] border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-200 shadow-md flex flex-col justify-between gap-6 cursor-pointer"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      {page.page_name}
                    </h2>
                    <p className="text-slate-400 text-xs md:text-sm line-clamp-2 min-h-[2rem]">
                      {page.note || '各機能の管理・詳細を行います。'}
                    </p>
                  </div>
                  <div className="text-cyan-400 text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    画面を開く &rarr;
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}