// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import html2canvas from 'html2canvas';

interface Transfer2480Item {
  id?: string;
  is_checked: boolean;
  server_name: string;
  game_account_name: string;
  game_id: string;
  current_power: string | number;
  transfer_period: string;
  memo: string;
  is_special_slot: boolean;
  is_regular_slot: boolean;
  is_free_slot: boolean;
  is_invited: boolean;
  is_transfer_completed: boolean;
}

const TRANSFER_PERIOD_OPTIONS = ['11/8', '12/6', '1/3', '1/31', '未定'];
const INVITATION_SLOT_OPTIONS = ['特枠', '普通', '自由'];

// 総力（1B, 700M, 500Kなど）を数値に変換してソートするためのヘルパー関数
const parsePowerToNumber = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim().toUpperCase();
  let multiplier = 1;
  if (str.endsWith('B')) {
    multiplier = 1_000_000_000;
  } else if (str.endsWith('M')) {
    multiplier = 1_000_000;
  } else if (str.endsWith('K')) {
    multiplier = 1_000;
  }
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num * multiplier;
};

// 画像エクスポート用モーダル
const ExportModal = ({
  isOpen,
  onClose,
  onExport
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (period: string, slots: string[]) => void;
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>(INVITATION_SLOT_OPTIONS);

  if (!isOpen) return null;

  const handleToggleSlot = (slot: string) => {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter(s => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const handleExecute = () => {
    if (!selectedPeriod) {
      alert('移民時期を選択してください。');
      return;
    }
    if (selectedSlots.length === 0) {
      alert('招待条件を少なくとも1つ選択してください。');
      return;
    }
    onExport(selectedPeriod, selectedSlots);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151c2c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">移民リスト画像エクスポート</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5">エクスポートする移民時期を選択 <span className="text-rose-500">*</span></label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"
            >
              <option value="">- 選択してください -</option>
              {TRANSFER_PERIOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">招待条件（複数選択可）</label>
            <div className="grid grid-cols-3 gap-2 bg-[#0b0f19] border border-slate-700 rounded-lg p-3">
              {INVITATION_SLOT_OPTIONS.map((slot) => (
                <label key={slot} className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedSlots.includes(slot)}
                    onChange={() => handleToggleSlot(slot)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>{slot}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition text-xs">キャンセル</button>
          <button type="button" onClick={handleExecute} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-950 text-xs">
            画像として保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Transfer2480Page() {
  const [items, setItems] = useState<Transfer2480Item[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // フィルター状態
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('ALL');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState('ALL');

  // 列ヘッダーフィルターの状態管理
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    server_name: [],
    transfer_period: [],
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBulkDeleteConfirming, setIsBulkDeleteConfirming] = useState(false);

  const [editingItem, setEditingItem] = useState<Transfer2480Item>({
    is_checked: false,
    server_name: '',
    game_account_name: '',
    game_id: '',
    current_power: '',
    transfer_period: '',
    memo: '',
    is_special_slot: false,
    is_regular_slot: false,
    is_free_slot: false,
    is_invited: false,
    is_transfer_completed: false,
  });

  const exportTableRef = useRef<HTMLDivElement>(null);
  const [exportTargetPeriod, setExportTargetPeriod] = useState<string | null>(null);
  const [exportTargetSlots, setExportTargetSlots] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('transfer_2480')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching 2480 transfer data:', error);
    } else {
      const initialized = (data || []).map(item => ({
        ...item,
        is_checked: false,
      }));
      setItems(initialized);
    }
  };

  const handleUpdateField = async (id: string, field: keyof Transfer2480Item, value: any) => {
    const { error } = await supabase
      .from('transfer_2480')
      .update({ [field]: value === '' ? null : value })
      .eq('id', id);

    if (error) {
      console.error('Update failed:', error);
      alert('更新に失敗しました。');
    } else {
      setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    }
  };

  const handleDeleteCheckedItems = async () => {
    const checkedItems = items.filter(i => i.is_checked && i.id);
    if (checkedItems.length === 0) return;

    if (!isBulkDeleteConfirming) {
      setIsBulkDeleteConfirming(true);
      return;
    }

    const ids = checkedItems.map(i => i.id!);
    const { error } = await supabase
      .from('transfer_2480')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Bulk delete failed:', error);
      alert('一括削除に失敗しました。');
    } else {
      setItems(items.filter(i => !i.is_checked));
    }
    setIsBulkDeleteConfirming(false);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingItem.server_name || !editingItem.game_id) {
      alert('「サーバー」と「ゲームID」は入力必須です。');
      return;
    }

    const payload = {
      server_name: editingItem.server_name,
      game_account_name: editingItem.game_account_name || null,
      game_id: editingItem.game_id,
      current_power: editingItem.current_power === '' ? null : editingItem.current_power,
      transfer_period: editingItem.transfer_period || null,
      memo: editingItem.memo || null,
      is_special_slot: editingItem.is_special_slot,
      is_regular_slot: editingItem.is_regular_slot,
      is_free_slot: editingItem.is_free_slot,
      is_invited: editingItem.is_invited,
      is_transfer_completed: editingItem.is_transfer_completed,
    };

    if (editingItem.id) {
      const { error } = await supabase
        .from('transfer_2480')
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
        .from('transfer_2480')
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
  };

  const handleOpenCreateModal = () => {
    setEditingItem({
      is_checked: false,
      server_name: '',
      game_account_name: '',
      game_id: '',
      current_power: '',
      transfer_period: '',
      memo: '',
      is_special_slot: false,
      is_regular_slot: false,
      is_free_slot: false,
      is_invited: false,
      is_transfer_completed: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Transfer2480Item) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return;
    const { error } = await supabase.from('transfer_2480').delete().eq('id', id);
    if (error) {
      alert('削除に失敗しました。');
    } else {
      setItems(items.filter(i => i.id !== id));
      setIsModalOpen(false);
    }
  };

  const handleExecuteExport = async (period: string, slots: string[]) => {
    setExportTargetPeriod(period);
    setExportTargetSlots(slots);
    setIsExportModalOpen(false);

    setTimeout(async () => {
      if (!exportTableRef.current) return;
      try {
        const canvas = await html2canvas(exportTableRef.current, {
          backgroundColor: '#0b0f19',
          scale: 2,
          logging: false,
          useCORS: true,
        });
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `2480移民リスト_${period}.png`;
        link.click();
      } catch (err) {
        console.error('Failed to export image:', err);
        alert('画像の出力に失敗しました。');
      } finally {
        setExportTargetPeriod(null);
      }
    }, 150);
  };

  // 共通のフィルタリングロジック（集計およびテーブルに適用）
  const getFilteredItemsForCore = () => {
    return items.filter(item => {
      const keyword = searchKeyword.toLowerCase();
      const name = String(item.game_account_name || '').toLowerCase();
      const gameId = String(item.game_id || '').toLowerCase();
      const server = String(item.server_name || '').toLowerCase();
      
      const matchesKeyword = name.includes(keyword) || gameId.includes(keyword) || server.includes(keyword);
      const matchesPeriod = selectedPeriodFilter === 'ALL' || item.transfer_period === selectedPeriodFilter;
      
      let matchesSlot = true;
      if (selectedSlotFilter === '特枠') matchesSlot = item.is_special_slot;
      else if (selectedSlotFilter === '普通') matchesSlot = item.is_regular_slot;
      else if (selectedSlotFilter === '自由') matchesSlot = item.is_free_slot;

      const matchesColServer = columnFilters.server_name.length === 0 || columnFilters.server_name.includes(item.server_name || '');
      const matchesColPeriod = columnFilters.transfer_period.length === 0 || columnFilters.transfer_period.includes(item.transfer_period || '');

      return matchesKeyword && matchesPeriod && matchesSlot && matchesColServer && matchesColPeriod;
    });
  };

  const filteredItems = getFilteredItemsForCore().sort((a, b) => {
    const powerA = parsePowerToNumber(a.current_power);
    const powerB = parsePowerToNumber(b.current_power);
    return powerB - powerA; // 総力順（降順）
  });

  // 集計用のデータソース（グローバルフィルタ・検索を反映）
  const baseItemsForStats = getFilteredItemsForCore();

  // カウント集計
  const countSpecial = baseItemsForStats.filter(i => i.is_special_slot).length;
  const countRegular = baseItemsForStats.filter(i => i.is_regular_slot).length;
  const countFree = baseItemsForStats.filter(i => i.is_free_slot).length;
  const countInvited = baseItemsForStats.filter(i => i.is_invited).length;
  const countCompleted = baseItemsForStats.filter(i => i.is_transfer_completed).length;

  // 画像エクスポート用の絞り込み
  const exportFilteredItems = exportTargetPeriod
    ? items.filter(i => {
        const matchesPeriod = i.transfer_period === exportTargetPeriod;
        const matchesSlot = exportTargetSlots.some(slot => {
          if (slot === '特枠') return i.is_special_slot;
          if (slot === '普通') return i.is_regular_slot;
          if (slot === '自由') return i.is_free_slot;
          return false;
        });
        return matchesPeriod && matchesSlot;
      })
    : [];

  const hasCheckedItems = items.some(i => i.is_checked);

  const getUniqueValuesForColumn = (columnKey: string) => {
    const values = new Set<string>();
    items.forEach(i => {
      const val = i[columnKey as keyof Transfer2480Item];
      if (val !== null && val !== undefined && val !== '') {
        values.add(String(val));
      }
    });
    return Array.from(values).sort();
  };

  const toggleColumnFilter = (columnKey: string, val: string) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || [];
      if (current.includes(val)) {
        return { ...prev, [columnKey]: current.filter(v => v !== val) };
      } else {
        return { ...prev, [columnKey]: [...current, val] };
      }
    });
  };

  const clearColumnFilter = (columnKey: string) => {
    setColumnFilters(prev => ({ ...prev, [columnKey]: [] }));
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 flex flex-col relative" onClick={() => setActiveFilterColumn(null)}>
      {/* ヘッダー */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📋</span> 2480 移民管理
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            サーバー2480向けの移民予定メンバーの確認および編集を行います。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasCheckedItems && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl">
              {isBulkDeleteConfirming && (
                <span className="text-xs text-rose-300 font-medium">本当に削除してもいいですか？</span>
              )}
              <button
                onClick={handleDeleteCheckedItems}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-rose-950 flex items-center gap-1 shrink-0"
              >
                <span>🗑️</span> {isBulkDeleteConfirming ? 'はい、削除する' : '選択した項目を削除'}
              </button>
              {isBulkDeleteConfirming && (
                <button
                  onClick={() => setIsBulkDeleteConfirming(false)}
                  className="text-xs text-slate-400 hover:text-white px-1"
                >
                  取消
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-950 flex items-center gap-1.5 shrink-0"
          >
            <span>📷</span> 画像Export
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 shrink-0"
          >
            <span>＋</span> 新規登録
          </button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center justify-between">
        <div className="max-w-md w-full">
          <input
            type="text"
            placeholder="サーバー、アカウント名、ゲームIDで検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500 shadow"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">移民時期:</span>
            <select
              value={selectedPeriodFilter}
              onChange={(e) => setSelectedPeriodFilter(e.target.value)}
              className="bg-[#151c2c] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="ALL">すべて表示</option>
              {TRANSFER_PERIOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">招待枠:</span>
            <select
              value={selectedSlotFilter}
              onChange={(e) => setSelectedSlotFilter(e.target.value)}
              className="bg-[#151c2c] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="ALL">すべて表示</option>
              {INVITATION_SLOT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ステータス別人数集計カードパネル */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 mb-4 shadow-xl space-y-3">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <span>📊</span> ステータス別人数集計
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* 特枠 */}
          <div className="bg-[#0b0f19] border border-amber-500/40 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-xs font-medium text-amber-400 mb-1">特枠</span>
            <span className="text-lg font-bold text-white font-mono">{countSpecial} <span className="text-xs font-normal text-slate-400">名</span></span>
          </div>
          {/* 普通 */}
          <div className="bg-[#0b0f19] border border-blue-500/40 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-xs font-medium text-blue-400 mb-1">普通</span>
            <span className="text-lg font-bold text-white font-mono">{countRegular} <span className="text-xs font-normal text-slate-400">名</span></span>
          </div>
          {/* 自由 */}
          <div className="bg-[#0b0f19] border border-emerald-500/40 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-xs font-medium text-emerald-400 mb-1">自由</span>
            <span className="text-lg font-bold text-white font-mono">{countFree} <span className="text-xs font-normal text-slate-400">名</span></span>
          </div>
          {/* 招待済 */}
          <div className="bg-[#0b0f19] border border-purple-500/40 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-xs font-medium text-purple-400 mb-1">招待済</span>
            <span className="text-lg font-bold text-white font-mono">{countInvited} <span className="text-xs font-normal text-slate-400">名</span></span>
          </div>
          {/* 移民完了 */}
          <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-inner col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-cyan-400 mb-1">移民完了</span>
            <span className="text-lg font-bold text-white font-mono">{countCompleted} <span className="text-xs font-normal text-slate-400">名</span></span>
          </div>
        </div>
      </div>

      {/* メインテーブル本体 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-x-auto flex-1 max-h-[70vh]">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0b0f19] text-[11px] text-slate-400 sticky top-0 z-30 whitespace-nowrap">
              <th className="p-3 font-semibold text-center w-[60px]">作業</th>
              <th className="p-3 font-semibold text-center w-[70px]">編集</th>
              
              {/* サーバー列（列フィルタ付き） */}
              <th className="p-3 font-semibold w-[120px] relative">
                <div className="flex items-center justify-between">
                  <span>サーバー</span>
                  <button onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'server_name' ? null : 'server_name'); }} className="hover:text-cyan-400 ml-1">🔍</button>
                </div>
                {activeFilterColumn === 'server_name' && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[#151c2c] border border-slate-700 rounded-xl p-3 shadow-2xl z-50 text-slate-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-700 text-[10px]">
                      <span>絞り込み選択</span>
                      <button onClick={() => clearColumnFilter('server_name')} className="text-cyan-400 hover:underline">クリア</button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {getUniqueValuesForColumn('server_name').map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="checkbox" checked={columnFilters.server_name.includes(val)} onChange={() => toggleColumnFilter('server_name', val)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                          <span className="truncate">{val}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="p-3 font-semibold w-[150px]">アカウント名</th>
              <th className="p-3 font-semibold w-[130px]">ゲームID</th>
              <th className="p-3 font-semibold w-[120px]">総力</th>

              {/* 移民時期列（列フィルタ付き） */}
              <th className="p-3 font-semibold w-[120px] relative">
                <div className="flex items-center justify-between">
                  <span>移民時期</span>
                  <button onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'transfer_period' ? null : 'transfer_period'); }} className="hover:text-cyan-400 ml-1">🔍</button>
                </div>
                {activeFilterColumn === 'transfer_period' && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[#151c2c] border border-slate-700 rounded-xl p-3 shadow-2xl z-50 text-slate-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-700 text-[10px]">
                      <span>絞り込み選択</span>
                      <button onClick={() => clearColumnFilter('transfer_period')} className="text-cyan-400 hover:underline">クリア</button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {TRANSFER_PERIOD_OPTIONS.map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="checkbox" checked={columnFilters.transfer_period.includes(val)} onChange={() => toggleColumnFilter('transfer_period', val)} className="rounded border-slate-700 bg-slate-900 text-cyan-500" />
                          <span className="truncate">{val}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="p-3 font-semibold w-[200px]">メモ</th>
              <th className="p-3 font-semibold text-center w-[70px]">特枠</th>
              <th className="p-3 font-semibold text-center w-[70px]">普通</th>
              <th className="p-3 font-semibold text-center w-[70px]">自由</th>
              <th className="p-3 font-semibold text-center w-[80px]">招待済</th>
              <th className="p-3 font-semibold text-center w-[90px]">移民完了</th>
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
                <tr key={item.id} className="hover:bg-slate-800/35 transition">
                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_checked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setItems(items.map(i => i.id === item.id ? { ...i, is_checked: checked } : i));
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition text-[11px]"
                    >
                      編集
                    </button>
                  </td>

                  <td className="p-3 text-slate-300 border-b border-slate-800/60">
                    {item.server_name || '-'}
                  </td>

                  <td className="p-3 text-slate-300 border-b border-slate-800/60">
                    {item.game_account_name || '-'}
                  </td>

                  <td className="p-3 font-mono text-slate-300 border-b border-slate-800/60">
                    {item.game_id || '-'}
                  </td>

                  <td className="p-3 font-mono text-slate-300 border-b border-slate-800/60">
                    {item.current_power || '-'}
                  </td>

                  <td className="p-3 text-slate-300 border-b border-slate-800/60">
                    {item.transfer_period || '-'}
                  </td>

                  <td className="p-3 text-slate-300 border-b border-slate-800/60">
                    {item.memo || '-'}
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_special_slot || false}
                      onChange={(e) => handleUpdateField(item.id!, 'is_special_slot', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                    />
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_regular_slot || false}
                      onChange={(e) => handleUpdateField(item.id!, 'is_regular_slot', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer accent-blue-500"
                    />
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_free_slot || false}
                      onChange={(e) => handleUpdateField(item.id!, 'is_free_slot', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                    />
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_invited || false}
                      onChange={(e) => handleUpdateField(item.id!, 'is_invited', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0 cursor-pointer accent-purple-500"
                    />
                  </td>

                  <td className="p-3 text-center border-b border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={item.is_transfer_completed || false}
                      onChange={(e) => handleUpdateField(item.id!, 'is_transfer_completed', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 画像エクスポート用の隠しプレビューテーブル */}
      {exportTargetPeriod && (
        <div className="absolute -top-[9999px] left-0 pointer-events-none">
          <div ref={exportTableRef} style={{ backgroundColor: '#0b0f19', color: '#f8fafc', padding: '24px', width: '1300px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>📋 2480 移民予定リスト</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                移民時期: {exportTargetPeriod} / 招待条件: {exportTargetSlots.join(', ')}
              </p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #1e293b', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#151c2c', color: '#94a3b8', fontSize: '11px', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>サーバー</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>アカウント名</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>ゲームID</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>総力</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>移民時期</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>メモ</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>特枠</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>普通</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>自由</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>招待済</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>移民完了</th>
                </tr>
              </thead>
              <tbody>
                {exportFilteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: '#64748b', backgroundColor: '#0b0f19' }}>
                      該当するデータがありません
                    </td>
                  </tr>
                ) : (
                  exportFilteredItems.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: '#0b0f19', borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>{item.server_name || '-'}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#ffffff' }}>{item.game_account_name || '-'}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#94a3b8' }}>{item.game_id || '-'}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#cbd5e1' }}>{item.current_power || '-'}</td>
                      <td style={{ padding: '12px', color: '#e2e8f0' }}>{item.transfer_period || '-'}</td>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>{item.memo || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: item.is_special_slot ? '#fbbf24' : '#64748b' }}>{item.is_special_slot ? '◯' : '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: item.is_regular_slot ? '#60a5fa' : '#64748b' }}>{item.is_regular_slot ? '◯' : '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: item.is_free_slot ? '#34d399' : '#64748b' }}>{item.is_free_slot ? '◯' : '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: item.is_invited ? '#c084fc' : '#64748b' }}>{item.is_invited ? '◯' : '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: item.is_transfer_completed ? '#38bdf8' : '#64748b' }}>{item.is_transfer_completed ? '◯' : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新規登録・編集用モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151c2c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingItem.id ? '移民メンバー編集' : '移民メンバー新規登録'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">サーバー <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editingItem.server_name}
                  onChange={(e) => setEditingItem({ ...editingItem, server_name: e.target.value })}
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">アカウント名</label>
                  <input
                    type="text"
                    value={editingItem.game_account_name}
                    onChange={(e) => setEditingItem({ ...editingItem, game_account_name: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">ゲームID <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingItem.game_id}
                    onChange={(e) => setEditingItem({ ...editingItem, game_id: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">総力</label>
                  <input
                    type="text"
                    value={editingItem.current_power}
                    onChange={(e) => setEditingItem({ ...editingItem, current_power: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">移民時期</label>
                  <select
                    value={editingItem.transfer_period}
                    onChange={(e) => setEditingItem({ ...editingItem, transfer_period: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">- (未選択)</option>
                    {TRANSFER_PERIOD_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">メモ</label>
                <textarea
                  rows={2}
                  value={editingItem.memo}
                  onChange={(e) => setEditingItem({ ...editingItem, memo: e.target.value })}
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-500 resize-y"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_special_slot}
                    onChange={(e) => setEditingItem({ ...editingItem, is_special_slot: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500"
                  />
                  <span className="text-amber-400 font-medium">特枠</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_regular_slot}
                    onChange={(e) => setEditingItem({ ...editingItem, is_regular_slot: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 accent-blue-500"
                  />
                  <span className="text-blue-400 font-medium">普通</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_free_slot}
                    onChange={(e) => setEditingItem({ ...editingItem, is_free_slot: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 accent-emerald-500"
                  />
                  <span className="text-emerald-400 font-medium">自由</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_invited}
                    onChange={(e) => setEditingItem({ ...editingItem, is_invited: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-500 accent-purple-500"
                  />
                  <span className="text-purple-400 font-medium">招待済</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.is_transfer_completed}
                    onChange={(e) => setEditingItem({ ...editingItem, is_transfer_completed: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 accent-cyan-500"
                  />
                  <span className="text-cyan-400 font-medium">移民完了</span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {editingItem.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(editingItem.id!)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition text-xs"
                  >
                    削除
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition">キャンセル</button>
                  <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition shadow-lg shadow-cyan-900/40">
                    {editingItem.id ? '更新する' : '登録する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 画像Export用条件指定モーダル */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExecuteExport}
      />
    </div>
  );
}