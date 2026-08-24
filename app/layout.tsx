// app/layout.tsx
import { AuthProvider } from '@/components/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import './globals.css';

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