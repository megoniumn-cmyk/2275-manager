// components/Navigation.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageItem {
  path: string;
  page_name: string;
  display_order: number;
  open: boolean;
  manage: boolean;
}

interface NavigationProps {
  userRoles?: string[];
  userRole?: string;
}

export default function Navigation({ userRoles, userRole = 'member' }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [pages, setPages] = useState<PageItem[]>([]);
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [isMasterOnly, setIsMasterOnly] = useState(false);
  const [roleDisplay, setRoleDisplay] = useState<string>('MEMBER');

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const roles = userRoles && userRoles.length > 0 ? userRoles : [userRole.toLowerCase()];
        const isMaster = roles.includes('master'); // masterのときだけ全許可にする
        
        setIsMasterOnly(isMaster);
        
        const primaryRole = roles.includes('master') ? 'master' : roles.includes('admin') ? 'admin' : roles[1] || roles[0];
        const roleMap: { [key: string]: string } = {
          master: 'MASTER',
          admin: 'ADMIN',
          strategy: 'STRATEGY',
          transfer: 'TRANSFER',
          member_manager: 'MEMBER_MANAGER',
          reserve_master: 'RESERVE_MASTER',
          r4: 'R4',
          gen_manage: 'GEN_MANAGE',
          priority_reserve: 'PRIORITY_RESERVE',
          member: 'MEMBER'
        };
        setRoleDisplay(roleMap[primaryRole] || 'MEMBER');

        if (isMaster) {
          setAllowedPaths(['*']);
        } else {
          // ADMINを含む一般ロールは role_permissions に登録されているパスのみ許可
          const { data: permData } = await supabase
            .from('role_permissions')
            .select('path')
            .in('web_role', roles);

          if (permData) {
            setAllowedPaths(permData.map((p) => p.path));
          } else {
            setAllowedPaths([]);
          }
        }

        const { data: pageData } = await supabase
          .from('page_list')
          .select('*')
          .eq('open', true)
          .order('display_order', { ascending: true });

        if (pageData) {
          setPages(pageData);
        }
      } catch (err) {
        console.error('ナビゲーション権限取得エラー:', err);
      }
    };

    fetchPermissions();
  }, [userRoles, userRole, pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('logged_in_game_id');
    localStorage.removeItem('redirect_after_login');
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <nav className="bg-[#111726] border-b border-slate-800/80 px-4 py-2.5 shrink-0 flex items-center justify-between gap-4 shadow-lg sticky top-0 z-50">
      
      {/* 左側：ロゴ ＆ メニュー群 */}
      <div className="flex items-center gap-4 overflow-x-auto py-1">
        <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition cursor-pointer shrink-0">
          <img 
            src="/icon.png" 
            alt="2275 MANAGER Icon" 
            className="w-7 h-7 rounded-lg object-cover shadow-sm border border-slate-700/80"
          />
          <span className="text-base font-bold text-white tracking-wide whitespace-nowrap">2275 MANAGER</span>
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          {pages.map((page) => {
            const hasPermission = 
              isMasterOnly || 
              allowedPaths.includes('*') || 
              allowedPaths.some((p) => {
                if (p === '/') return page.path === '/';
                return page.path === p || page.path.startsWith(p + '/');
              });

            if (!hasPermission) return null;

            const isActive = pathname === page.path;
            const isManage = page.manage;

            return (
              <Link
                key={page.path}
                href={page.path}
                className={`text-xs font-medium tracking-wide transition-all duration-150 cursor-pointer px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
                  isActive
                    ? isManage
                      ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-inner border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-inner border border-cyan-500/30'
                    : isManage
                    ? 'text-amber-200/70 hover:text-amber-200 hover:bg-amber-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                {page.page_name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 右側：ロール表示 ＆ ログアウトボタン */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="hidden lg:flex items-center px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-cyan-400 font-mono text-[11px] tracking-wider shadow-sm whitespace-nowrap">
          ROLE: {roleDisplay}
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 rounded-lg text-xs font-medium transition shadow-sm cursor-pointer border border-rose-800/60 whitespace-nowrap"
        >
          ログアウト
        </button>
      </div>
    </nav>
  );
}