'use client';

import { useEffect, useState, memo } from 'react';
import { supabase } from '@/lib/supabase';

interface TransferItem {
  id?: string;
  is_checked: boolean;
  status: string;
  server_name: string;
  alliance_name: string;
  game_account_name: string;
  game_id: string;
  fc: string;
  shield_soldier: string;
  spear_soldier: string;
  bow_soldier: string;
  power_after: string | number;
  power_before: string | number;
  transfer_period: string;
  invitation_slot: string;
  alliance_after: string;
  remarks: string;
}

interface AllianceItem {
  id?: string;
  alliance: string;
  display_order: number;
}

const FC_OPTIONS = ['FC10', 'FC9', 'FC8', 'FC7', 'FC6以下'];
const SOLDIER_OPTIONS = ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11', 'FC10T10', 'FC9T10', 'FC8T10', 'FC7T10', 'FC6T10以下'];
const INVITATION_SLOT_OPTIONS = ['普通', '特枠'];
const STATUS_OPTIONS = ['問い合わせ', '移民検討中', '移民確定'];

const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case '問い合わせ':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case '移民検討中':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case '移民確定':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
};

// 同盟リスト管理モーダル
const AllianceListModal = memo(({
  isOpen,
  onClose,
  allianceItems,
  onRefresh
}: {
  isOpen: boolean;
  onClose: () => void;
  allianceItems: AllianceItem[];
  onRefresh: () => void;
}) => {
  const [newAllianceName, setNewAllianceName] = useState('');

  if (!isOpen) return null;

  const handleAddAlliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllianceName.trim()) return;

    const maxOrder = allianceItems.reduce((max, item) => (item.display_order > max ? item.display_order : max), 0);
    const nextOrder = maxOrder + 1;

    const { error } = await supabase.from('alliance_list').insert([{
      alliance: newAllianceName,
      display_order: nextOrder
    }]);

    if (error) {
      console.error('Failed to add alliance:', error);
      alert('同盟の登録に失敗しました。');
    } else {
      setNewAllianceName('');
      onRefresh();
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= allianceItems.length) return;

    const currentItem = allianceItems[index];
    const targetItem = allianceItems[targetIndex];

    const { error: err1 } = await supabase.from('alliance_list').update({ display_order: targetItem.display_order }).eq('id', currentItem.id);
    const { error: err2 } = await supabase.from('alliance_list').update({ display_order: currentItem.display_order }).eq('id', targetItem.id);

    if (err1 || err2) {
      console.error('Failed to update order');
    } else {
      onRefresh();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">同盟リスト管理</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <form onSubmit={handleAddAlliance} className="flex gap-2 items-end bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-xs">
          <div className="flex-1">
            <label className="block text-slate-400 mb-1">同盟名</label>
            <input
              type="text"
              required
              value={newAllianceName}
              onChange={(e) => setNewAllianceName(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500"
              placeholder="UTP"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition h-[34px]">
            追加
          </button>
        </form>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {allianceItems.map((item, index) => (
            <div key={item.id || index} className="flex items-center justify-between bg-[#0b0f19] border border-slate-800 p-3 rounded-xl text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono w-6">#{item.display_order}</span>
                <div>
                  <span className="font-bold text-white">{item.alliance}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveOrder(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded text-xs"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveOrder(index, 'down')}
                  disabled={index === allianceItems.length - 1}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded text-xs"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
AllianceListModal.displayName = 'AllianceListModal';

// 新規登録・編集用モーダル
const MemberModal = ({
  isOpen,
  onClose,
  onSubmit,
  item,
  setItem,
  transferOptions,
  allianceListOptions,
  isEditMode
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  item: TransferItem;
  setItem: React.Dispatch<React.SetStateAction<TransferItem>>;
  transferOptions: { label: string }[];
  allianceListOptions: string[];
  isEditMode: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">
            {isEditMode ? '移民メンバー編集' : '移民メンバー新規登録'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">サーバー名 <span className="text-rose-500">*</span></label>
              <input type="text" required value={item.server_name || ''} onChange={(e) => setItem(prev => ({ ...prev, server_name: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">同盟名 <span className="text-rose-500">*</span></label>
              <input type="text" required value={item.alliance_name || ''} onChange={(e) => setItem(prev => ({ ...prev, alliance_name: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">ゲームアカウント名 <span className="text-rose-500">*</span></label>
              <input type="text" required value={item.game_account_name || ''} onChange={(e) => setItem(prev => ({ ...prev, game_account_name: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ゲームID <span className="text-rose-500">*</span></label>
              <input type="text" required value={item.game_id || ''} onChange={(e) => setItem(prev => ({ ...prev, game_id: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">FC <span className="text-rose-500">*</span></label>
              <select required value={item.fc || ''} onChange={(e) => setItem(prev => ({ ...prev, fc: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {FC_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">総力(削減前) <span className="text-rose-500">*</span></label>
              <input type="text" required value={item.power_before || ''} onChange={(e) => setItem(prev => ({ ...prev, power_before: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">盾兵</label>
              <select value={item.shield_soldier || ''} onChange={(e) => setItem(prev => ({ ...prev, shield_soldier: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">槍兵</label>
              <select value={item.spear_soldier || ''} onChange={(e) => setItem(prev => ({ ...prev, spear_soldier: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">弓兵</label>
              <select value={item.bow_soldier || ''} onChange={(e) => setItem(prev => ({ ...prev, bow_soldier: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">総力(削減後)</label>
              <input type="text" value={item.power_after || ''} onChange={(e) => setItem(prev => ({ ...prev, power_after: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">移民時期 <span className="text-rose-500">*</span></label>
              <select required value={item.transfer_period || ''} onChange={(e) => setItem(prev => ({ ...prev, transfer_period: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {transferOptions.map((opt, idx) => <option key={idx} value={opt.label}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">招待枠</label>
              <select value={item.invitation_slot || ''} onChange={(e) => setItem(prev => ({ ...prev, invitation_slot: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {INVITATION_SLOT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ステータス <span className="text-rose-500">*</span></label>
              <select required value={item.status || ''} onChange={(e) => setItem(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
                <option value="">- (未選択)</option>
                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">同盟(移民後)</label>
            <select value={item.alliance_after || ''} onChange={(e) => setItem(prev => ({ ...prev, alliance_after: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500">
              <option value="">- (未選択)</option>
              {allianceListOptions.map((allianceName, idx) => (
                <option key={idx} value={allianceName}>{allianceName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">備考</label>
            <textarea rows={3} value={item.remarks || ''} onChange={(e) => setItem(prev => ({ ...prev, remarks: e.target.value }))} className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500 resize-y" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition">キャンセル</button>
            <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition shadow-lg shadow-cyan-900/40">
              {isEditMode ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const initialFormState: TransferItem = {
  is_checked: false,
  status: '',
  server_name: '',
  alliance_name: '',
  game_account_name: '',
  game_id: '',
  fc: '',
  shield_soldier: '',
  spear_soldier: '',
  bow_soldier: '',
  power_after: '',
  power_before: '',
  transfer_period: '',
  invitation_slot: '',
  alliance_after: '',
  remarks: '',
};

export default function TransferManagementPage() {
  const [items, setItems] = useState<TransferItem[]>([]);
  const [transferOptions, setTransferOptions] = useState<{ label: string }[]>([]);
  const [allianceListRecords, setAllianceListRecords] = useState<AllianceItem[]>([]);
  const [allianceListOptions, setAllianceListOptions] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAllianceModalOpen, setIsAllianceModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<TransferItem>(initialFormState);

  useEffect(() => {
    fetchData();
    fetchTransferOptions();
    fetchAllianceList();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase.from('transfer_management').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error fetching data:', error);
    else setItems(data || []);
  };

  const fetchTransferOptions = async () => {
    const { data, error } = await supabase.from('transfer_options').select('label');
    if (error) console.error('Error fetching options:', error);
    else setTransferOptions(data || []);
  };

  const fetchAllianceList = async () => {
    const { data, error } = await supabase.from('alliance_list').select('*').order('display_order', { ascending: true });
    if (error) console.error('Error fetching alliance list:', error);
    else {
      setAllianceListRecords(data || []);
      setAllianceListOptions((data || []).map(row => row.alliance).filter(Boolean));
    }
  };

  const handleUpdateField = async (id: string, field: keyof TransferItem, value: any) => {
    const { error } = await supabase
      .from('transfer_management')
      .update({ [field]: value === '' ? null : value })
      .eq('id', id);

    if (error) {
      console.error('Update failed:', error);
    } else {
      setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    }
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingItem.transfer_period) {
      alert('移民時期は必須です。');
      return;
    }

    const payload = {
      ...editingItem,
      status: editingItem.status === '' ? null : editingItem.status,
      shield_soldier: editingItem.shield_soldier === '' ? null : editingItem.shield_soldier,
      spear_soldier: editingItem.spear_soldier === '' ? null : editingItem.spear_soldier,
      bow_soldier: editingItem.bow_soldier === '' ? null : editingItem.bow_soldier,
      power_after: editingItem.power_after === '' ? null : editingItem.power_after,
      power_before: editingItem.power_before === '' ? null : editingItem.power_before,
      transfer_period: editingItem.transfer_period === '' ? null : editingItem.transfer_period,
      invitation_slot: editingItem.invitation_slot === '' ? null : editingItem.invitation_slot,
      alliance_after: editingItem.alliance_after === '' ? null : editingItem.alliance_after,
      remarks: editingItem.remarks === '' ? null : editingItem.remarks,
    };

    if (editingItem.id) {
      const { error } = await supabase
        .from('transfer_management')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Update failed:', error);
        alert('更新に失敗しました。');
        return;
      }

      setItems(items.map(i => i.id === editingItem.id ? { ...i, ...editingItem } : i));
    } else {
      const { data, error } = await supabase
        .from('transfer_management')
        .insert([payload])
        .select();

      if (error) {
        console.error('Insert failed:', error);
        alert('登録に失敗しました。');
        return;
      }

      if (data) setItems([...data, ...items]);
    }

    setIsModalOpen(false);
    setEditingItem(initialFormState);
  };

  const handleOpenCreateModal = () => {
    setEditingItem(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TransferItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleRegisterToMembers = async () => {
    const checkedItems = items.filter(i => i.is_checked);
    if (checkedItems.length === 0) {
      alert('メンバーが選択されていません。');
      return;
    }

    for (const item of checkedItems) {
      if (!item.transfer_period) {
        alert(`アカウント「${item.game_account_name || item.game_id}」の移民時期が入力されていません。移民時期の入力は必須です。`);
        return;
      }
    }

    let successCount = 0;

    for (const item of checkedItems) {
      if (!item.game_id) continue;

      const { data: existingMembers, error: memberFetchErr } = await supabase
        .from('members')
        .select('*')
        .eq('game_id', item.game_id);

      if (!memberFetchErr) {
        const targetServerName = item.server_name ? String(item.server_name) : '';

        if (existingMembers && existingMembers.length > 0) {
          const existingMember = existingMembers[0];
          let updatedState = existingMember.state || '';

          if (targetServerName) {
            const statesArray = updatedState ? updatedState.split(',').map((s: string) => s.trim()) : [];
            if (!statesArray.includes(targetServerName)) {
              statesArray.push(targetServerName);
              updatedState = statesArray.join(',');

              await supabase
                .from('members')
                .update({ state: updatedState })
                .eq('id', existingMember.id);
            }
          }
        } else {
          const discordId = `no_discord${item.game_id}`;
          const memberPayload = {
            name: item.game_account_name,
            game_id: item.game_id,
            fc_level: item.fc || null,
            shield_soldier: item.shield_soldier || null,
            spear_soldier: item.spear_soldier || null,
            bow_soldier: item.bow_soldier || null,
            current_power: item.power_after || null,
            power_before_migration: item.power_before || null,
            transfer: item.transfer_period || null,
            alliance: item.alliance_after || null,
            note: item.remarks || null,
            status: 'active',
            discord_id: discordId,
            state: targetServerName || null,
          };

          await supabase.from('members').insert([memberPayload]);
        }
        successCount++;
      }
    }

    alert(`${successCount}件のメンバー情報をmembersテーブルに反映しました。`);
  };

  const filteredItems = items.filter(item => {
    const keyword = searchKeyword.toLowerCase();
    const name = String(item.game_account_name || '').toLowerCase();
    const gameId = String(item.game_id || '').toLowerCase();
    const alliance = String(item.alliance_name || '').toLowerCase();
    
    const matchesKeyword = name.includes(keyword) || gameId.includes(keyword) || alliance.includes(keyword);
    const matchesPeriod = selectedPeriodFilter === 'ALL' || item.transfer_period === selectedPeriodFilter;

    return matchesKeyword && matchesPeriod;
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 flex flex-col">
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📋</span> 移民管理
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            移民予定メンバーの一覧確認、詳細データの編集、新規追加を行います。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegisterToMembers}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 shrink-0"
          >
            <span>👥</span> 選択したメンバーを登録
          </button>
          <button
            onClick={() => setIsAllianceModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1.5 shrink-0"
          >
            <span>⚙️</span> 同盟リスト
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 shrink-0"
          >
            <span>＋</span> 新規登録
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center justify-between">
        <div className="max-w-md w-full">
          <input
            type="text"
            placeholder="名前、ゲームID、同盟で検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500 shadow"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">移民時期フィルター:</span>
          <select
            value={selectedPeriodFilter}
            onChange={(e) => setSelectedPeriodFilter(e.target.value)}
            className="bg-[#151c2c] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
          >
            <option value="ALL">すべて表示</option>
            {transferOptions.map((opt, idx) => (
              <option key={idx} value={opt.label}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-x-auto flex-1 max-h-[70vh]">
        <table className="w-full text-left border-collapse min-w-[1700px] table-fixed">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0b0f19] text-[11px] text-slate-400 sticky top-0 z-30 whitespace-nowrap">
              <th className="p-0 sticky left-0 z-30 bg-[#0b0f19] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] w-[450px]">
                <div className="flex items-center">
                  <div className="p-3 font-semibold text-center w-[50px] shrink-0 border-b border-slate-800">作業</div>
                  <div className="p-3 font-semibold text-center w-[65px] shrink-0 border-b border-slate-800">編集</div>
                  <div className="p-3 font-semibold w-[85px] shrink-0 border-b border-slate-800">サーバー</div>
                  <div className="p-3 font-semibold w-[130px] shrink-0 border-b border-slate-800">アカウント名</div>
                  <div className="p-3 font-semibold w-[120px] shrink-0 border-b border-slate-800">ステータス</div>
                </div>
              </th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">同盟名</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">ゲームID</th>
              <th className="p-3 font-semibold w-[120px] border-b border-slate-800">FC</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">盾兵</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">槍兵</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">弓兵</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">総力(後)</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">総力(前)</th>
              <th className="p-3 font-semibold w-[120px] border-b border-slate-800">移民時期</th>
              <th className="p-3 font-semibold w-[90px] border-b border-slate-800">招待枠</th>
              <th className="p-3 font-semibold w-[120px] border-b border-slate-800">同盟(移民後)</th>
              <th className="p-3 font-semibold w-[180px] border-b border-slate-800">備考</th>
            </tr>
          </thead>
          <tbody className="text-xs whitespace-nowrap">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-12 text-slate-500">
                  データがありません
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition group">
                  <td className="p-0 sticky left-0 z-20 bg-[#151c2c] group-hover:bg-[#1a2338] transition shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-b border-slate-800/60 w-[450px]">
                    <div className="flex items-center">
                      <div className="p-3 text-center w-[50px] shrink-0">
                        <input
                          type="checkbox"
                          checked={item.is_checked}
                          onChange={(e) => handleUpdateField(item.id!, 'is_checked', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </div>
                      <div className="p-3 text-center w-[65px] shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition text-[11px] shadow-sm shadow-cyan-950 whitespace-nowrap"
                        >
                          編集
                        </button>
                      </div>
                      <div className="p-3 text-slate-300 w-[85px] shrink-0 truncate">
                        {item.server_name || '-'}
                      </div>
                      <div className="p-3 font-bold text-white w-[130px] shrink-0 truncate">
                        {item.game_account_name || '-'}
                      </div>
                      <div className="p-3 w-[120px] shrink-0">
                        <span className={`inline-block border rounded-md px-2 py-0.5 font-medium text-[11px] text-center w-full truncate ${getStatusBadgeStyle(item.status)}`}>
                          {item.status || '-'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-slate-300 w-[110px] truncate border-b border-slate-800/60">
                    {item.alliance_name || '-'}
                  </td>

                  <td className="p-3 font-mono text-slate-400 w-[110px] truncate border-b border-slate-800/60">
                    {item.game_id || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[120px] truncate border-b border-slate-800/60">
                    {item.fc || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[110px] truncate border-b border-slate-800/60">
                    {item.shield_soldier || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[110px] truncate border-b border-slate-800/60">
                    {item.spear_soldier || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[110px] truncate border-b border-slate-800/60">
                    {item.bow_soldier || '-'}
                  </td>

                  <td className="p-3 text-slate-300 w-[110px] truncate border-b border-slate-800/60">
                    {item.power_after || '-'}
                  </td>

                  <td className="p-3 text-slate-300 w-[110px] truncate border-b border-slate-800/60">
                    {item.power_before || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[120px] truncate border-b border-slate-800/60">
                    {item.transfer_period || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[90px] truncate border-b border-slate-800/60">
                    {item.invitation_slot || '-'}
                  </td>

                  <td className="p-3 text-slate-200 w-[120px] truncate border-b border-slate-800/60">
                    {item.alliance_after || '-'}
                  </td>

                  <td className="p-3 text-slate-300 w-[180px] truncate border-b border-slate-800/60">
                    {item.remarks || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        item={editingItem}
        setItem={setEditingItem}
        transferOptions={transferOptions}
        allianceListOptions={allianceListOptions}
        isEditMode={!!editingItem.id}
      />

      <AllianceListModal
        isOpen={isAllianceModalOpen}
        onClose={() => setIsAllianceModalOpen(false)}
        allianceItems={allianceListRecords}
        onRefresh={fetchAllianceList}
      />
    </div>
  );
}