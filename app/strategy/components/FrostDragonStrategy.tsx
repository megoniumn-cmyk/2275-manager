// app/coming-soon/page.tsx
'use client';


export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col">
      {/* 共通のナビゲーションを表示 */}

      {/* メインコンテンツエリア */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="bg-[#151c2c] border border-slate-800 rounded-2xl p-10 shadow-2xl flex flex-col items-center max-w-md w-full space-y-6">
          
          {/* カービィをイメージしたスリープアイコン＆アニメーション演出 */}
          <div className="w-28 h-28 flex items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-inner relative">
            <span className="text-5xl select-none animate-pulse">
              😴
            </span>
            <div className="absolute -top-2 -right-2 flex space-x-1">
              <span className="text-blue-400 font-bold text-sm animate-bounce">z</span>
              <span className="text-blue-400 font-bold text-xs animate-bounce delay-100">Z</span>
              <span className="text-blue-400 font-bold text-[10px] animate-bounce delay-200">z</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-wider text-white">
              準備中... 💤
            </h1>
            <p className="text-sm text-slate-400">
              このページは現在作成中です。公開までもうしばらくお待ちください。
            </p>
          </div>

          {/* トップへ戻るボタン */}
          <a
            href="/"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition shadow"
          >
            トップページへ戻る
          </a>
        </div>
      </main>
    </div>
  );
}