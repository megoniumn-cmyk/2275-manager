'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';

export default function ClientNavigation() {
  const pathname = usePathname();

  // ログイン画面のときはナビゲーションを表示しない
  if (pathname === '/login') {
    return null;
  }

  return <Navigation />;
}