// app/submit/page.tsx
'use client'

import { useState } from 'react'

const PACK_TEMPLATES: Record<string, string[]> = {
  "Generation 1": ["デイリー補給", "成長基金", "特権パス"],
  "Generation 2": ["精鋭パック", "英雄育成パック", "上級加速パック"],
}

// ご提示いただいたホワサバの主要アイテムリスト
const PACK_ITEMS = [
  { key: 'fire_crystal', label: '火晶' },
  { key: 'fire_crystal_dust', label: '火晶微粒子' },
  { key: 'refined_fire_crystal', label: '精錬火晶' },
  { key: 'energy', label: 'エナジー' },
  { key: 'lucky_gear_chest', label: 'ラッキー装備宝箱' },
  { key: 'legend_gear_chest', label: 'レジェンド装備宝箱' },
  { key: 'pet_food', label: 'ペットの餌' },
  { key: 'pet_breakthrough_box', label: 'ペット突破素セレクト箱' },
  { key: 'normal_wild_seal', label: '通常野生の印' },
  { key: 'advanced_wild_seal', label: '上級野生の印' },
  { key: 'gem_handbook', label: '宝石ハンドブック' },
  { key: 'gem_blueprint', label: '宝石図面' },
  { key: 'gem_codex', label: '宝石秘典' },
  { key: 'speed_1h', label: '1時間一般加速' },
  { key: 'vip_points', label: 'VIPポイント' },
  { key: 'gems', label: 'ダイヤ' },
]

export default function SubmitPage() {
  const [generation, setGeneration] = useState('Generation 1')
  const [packName, setPackName] = useState('デイリー補給')
  const [price, setPrice] = useState('610')
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [file, setFile] = useState<File | null>(null)

  const handleItemChange = (label: string, value: number) => {
    if (value > 0) {
      setItemCounts(prev => ({ ...prev, [label]: value }))
    } else {
      const copy = { ...prev }
      delete copy[label]
      setItemCounts(copy)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // 登録処理（Supabase連携など）
    console.log({ generation, packName, price, itemCounts, file })
    alert('パックデータを登録しました！')
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-900 text-white rounded-xl">
      <h1 className="text-2xl font-bold mb-6">課金パックデータ登録</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">世代</label>
            <select 
              value={generation} 
              onChange={e => setGeneration(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm"
            >
              <option value="Generation 1">Generation 1</option>
              <option value="Generation 2">Generation 2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">パック名</label>
            <select 
              value={packName} 
              onChange={e => setPackName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm"
            >
              {(PACK_TEMPLATES[generation] || []).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">金額 (JPY)</label>
            <input 
              type="number" 
              value={price} 
              onChange={e => setPrice(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm"
            />
          </div>
        </div>

        {/* アイテム入力欄（グリッド形式） */}
        <div className="border border-slate-700 p-4 rounded-lg space-y-3 bg-slate-800/40">
          <h3 className="font-semibold text-slate-200 text-sm">パック内アイテム個数入力（入っているものだけ入力）</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PACK_ITEMS.map(item => (
              <div key={item.key} className="bg-slate-800 p-2 rounded border border-slate-700/60">
                <label className="block text-xs text-slate-400 mb-1 truncate">{item.label}</label>
                <input 
                  type="number" 
                  min="0"
                  value={itemCounts[item.label] || ''}
                  onChange={e => handleItemChange(item.label, Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-center"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* スクショ添付 */}
        <div>
          <label className="block text-sm mb-1">スクリーンショット添付</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={e => e.target.files && setFile(e.target.files[0])}
            className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition text-sm"
        >
          登録する
        </button>
      </form>
    </div>
  )
}