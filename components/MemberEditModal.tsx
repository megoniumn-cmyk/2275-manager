// components/MemberEditModal.tsx
'use client';

import { Member } from '@/types';

type Props = {
  editingMember: Member;
  setEditingMember: (member: Member | null) => void;
  onSave: (e: React.FormEvent) => void;
  transferOptions: string[];
  existingStateList: string[];
  stateInputTerm: string;
  setStateInputTerm: (term: string) => void;
  toggleStateSelect: (stateVal: string) => void;
  selectedStates: string[];
  handleAddNewState: (val: string) => void;
};

const SOLDIER_OPTIONS = [
  'FC10T12', 'FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11',
  'FC10T10', 'FC9T10', 'FC8T10', 'FC7T10', 'FC6T10以下'
];

const FC_LEVEL_OPTIONS = ['FC5以下', 'FC6', 'FC7', 'FC8', 'FC9', 'FC10'];
const BEAR_OPTIONS = ['21時', '23時', '両方'];
const ALLIANCE_OPTIONS = ['GOD', 'GEN', 'www', 'MSO'];
const PLANET_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function MemberEditModal({
  editingMember,
  setEditingMember,
  onSave,
  transferOptions,
  existingStateList,
  stateInputTerm,
  setStateInputTerm,
  toggleStateSelect,
  selectedStates,
  handleAddNewState,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151c2c] border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-xs">
        <h2 className="text-sm font-bold mb-4 text-white">メンバー情報の編集: {editingMember.name}</h2>
        
        <form onSubmit={onSave} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* 名前 (Discord非参加時は手入力可、自動入力はBot側想定) */}
            <div>
              <label className="block text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={editingMember.name || ''}
                onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* 役職 */}
            <div>
              <label className="block text-slate-400 mb-1">Role</label>
              <input
                type="text"
                value={editingMember.rank_role || ''}
                onChange={(e) => setEditingMember({ ...editingMember, rank_role: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                placeholder="R4以上 / R3 / R2 / R1 など"
              />
            </div>

            {/* ゲームID */}
            <div>
              <label className="block text-slate-400 mb-1">Game ID</label>
              <input
                type="text"
                value={editingMember.game_id || ''}
                onChange={(e) => setEditingMember({ ...editingMember, game_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* 所属同盟 */}
            <div>
              <label className="block text-slate-400 mb-1">所属同盟</label>
              <select
                value={editingMember.alliance || ''}
                onChange={(e) => setEditingMember({ ...editingMember, alliance: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {ALLIANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* FCレベル */}
            <div>
              <label className="block text-slate-400 mb-1">FCレベル</label>
              <select
                value={editingMember.fc_level || ''}
                onChange={(e) => setEditingMember({ ...editingMember, fc_level: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {FC_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 惑星レベル */}
            <div>
              <label className="block text-slate-400 mb-1">惑星レベル</label>
              <select
                value={editingMember.planet ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, planet: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {PLANET_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* リーダーフラグ */}
            <div>
              <label className="block text-slate-400 mb-1">リーダー</label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer bg-slate-900/50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={!!editingMember.leader}
                  onChange={(e) => setEditingMember({ ...editingMember, leader: e.target.checked ? true : null })}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600"
                />
                <span className="text-white">リーダー</span>
              </label>
            </div>

            {/* 移民時期 */}
            <div>
              <label className="block text-slate-400 mb-1">移民時期 (transfer)</label>
              <select
                value={editingMember.transfer || ''}
                onChange={(e) => setEditingMember({ ...editingMember, transfer: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {transferOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 熊罠 */}
            <div>
              <label className="block text-slate-400 mb-1">熊罠 (bear)</label>
              <select
                value={editingMember.bear || ''}
                onChange={(e) => setEditingMember({ ...editingMember, bear: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {BEAR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 盾兵 */}
            <div>
              <label className="block text-slate-400 mb-1">盾兵</label>
              <select
                value={editingMember.shield_soldier || ''}
                onChange={(e) => setEditingMember({ ...editingMember, shield_soldier: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {SOLDIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 槍兵 */}
            <div>
              <label className="block text-slate-400 mb-1">槍兵</label>
              <select
                value={editingMember.spear_soldier || ''}
                onChange={(e) => setEditingMember({ ...editingMember, spear_soldier: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {SOLDIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 弓兵 */}
            <div>
              <label className="block text-slate-400 mb-1">弓兵</label>
              <select
                value={editingMember.bow_soldier || ''}
                onChange={(e) => setEditingMember({ ...editingMember, bow_soldier: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                {SOLDIER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* 総力(移民前) */}
            <div>
              <label className="block text-slate-400 mb-1">総力(移民前)</label>
              <input
                type="text"
                value={editingMember.power_before_migration ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, power_before_migration: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* 総力(現在) */}
            <div>
              <label className="block text-slate-400 mb-1">総力(現在)</label>
              <input
                type="text"
                value={editingMember.current_power ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, current_power: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* 情報共有 */}
            <div>
              <label className="block text-slate-400 mb-1">情報共有 (info_sharing)</label>
              <select
                value={editingMember.info_sharing === true ? '参加' : editingMember.info_sharing === false ? '不参加' : ''}
                onChange={(e) => {
                  const val = e.target.value === '参加' ? true : e.target.value === '不参加' ? false : null;
                  setEditingMember({ ...editingMember, info_sharing: val });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="">未選択</option>
                <option value="参加">参加</option>
                <option value="不参加">不参加</option>
              </select>
            </div>

            {/* ガレス スキル2 */}
            <div>
              <label className="block text-slate-400 mb-1">ガレス スキル2 (0〜20)</label>
              <input
                type="number"
                min="0"
                max="20"
                value={editingMember.gareth_2 ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, gareth_2: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* ガレス スキル3 */}
            <div>
              <label className="block text-slate-400 mb-1">ガレス スキル3 (0〜20)</label>
              <input
                type="number"
                min="0"
                max="20"
                value={editingMember.gareth_3 ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, gareth_3: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            {/* ガレス スキル4 */}
            <div>
              <label className="block text-slate-400 mb-1">ガレス スキル4 (0〜20)</label>
              <input
                type="number"
                min="0"
                max="20"
                value={editingMember.gareth_4 ?? ''}
                onChange={(e) => setEditingMember({ ...editingMember, gareth_4: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
          </div>

          {/* 元鯖 (state) の選択/入力エリア */}
          <div className="border-t border-slate-700 pt-3">
            <label className="block text-slate-300 font-bold mb-1">元鯖 (state)</label>
            <p className="text-slate-400 text-[10px] mb-2">既存の数字ボタンを押して選択、または新規に数字を入力して追加できます。</p>
            <input
              type="text"
              value={editingMember.state || ''}
              onChange={(e) => setEditingMember({ ...editingMember, state: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mb-2 font-mono"
              placeholder="例: 2352, 2359"
            />
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-slate-400 mr-1">登録済みサーバーから選択:</span>
              {existingStateList.map((st) => {
                const isSelected = selectedStates.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleStateSelect(st)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 英雄所持状況 */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-300 font-bold mb-2">英雄所持状況</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'hero_hendrik', label: 'ヘンドリック' },
                { key: 'hero_gatto', label: 'ガト' },
                { key: 'hero_gordon', label: 'ゴードン' },
                { key: 'hero_muming', label: '無名' },
                { key: 'hero_renee', label: 'レネ' },
                { key: 'hero_norah', label: 'ノラ' },
                { key: 'hero_mia', label: 'ミア' },
                { key: 'hero_phily', label: 'フレンダー' },
                { key: 'hero_zinman', label: 'ジンマン' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded cursor-pointer hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={!!(editingMember as any)[key]}
                    onChange={(e) => setEditingMember({ ...editingMember, [key]: e.target.checked ? true : null })}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600"
                  />
                  <span className="text-slate-200">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ボタン類 */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setEditingMember(null)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
            >
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}