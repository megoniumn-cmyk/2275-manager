// app/layout.tsx
import { AuthProvider } from '@/components/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '2275 MANAGER',
  description: 'Whiteout Survival Alliance Dashboard',
  icons: {
    icon: '/favicon.png', // publicフォルダにある場合はルートからのパスでOK
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-[#0b0f19] text-slate-100 min-h-screen flex flex-col">
        <AuthProvider>
          <AuthGuard>
            <main className="flex-1 flex flex-col">
              {children}
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}