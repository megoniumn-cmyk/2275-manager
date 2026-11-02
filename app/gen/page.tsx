// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface MemberItem {
  id?: string;
  is_checked?: boolean;
  name: string;
  game_id: string;
  rank_role: string;
  fc_level: string;
  current_power: string | number;
  status_type: string;
  is_2480: boolean;
  migration_dest: string;
  migration_time: string;
  remarks: string;
}

const STATUS_TYPE_OPTIONS = ['移民', '移籍', 'GEN', '引退', '検討中', 'その他'];
const MIGRATION_TIME_OPTIONS = ['11/8', '12/6', '1/3', '1/31', '未定'];

type SortField = keyof MemberItem;
type SortOrder = 'asc' | 'desc';

export default function GenMemberManagementPage() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  
  // フリーワード検索
  const [globalSearch, setGlobalSearch] = useState('');

  // 各列ごとのチェックボックスフィルター状態
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    name: [],
    game_id: [],
    rank_role: [],
    fc_level: [],
    current_power: [],
    status_type: [],
    is_2480: [],
    migration_dest: [],
    migration_time: [],
    remarks: [],
  });

  // どの列のフィルターポップアップが開いているか
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchGenMembers();
  }, []);

  // ポップアップ外クリックで閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchGenMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('alliance', 'GEN')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching GEN members:', error);
    } else {
      const initialized = (data || []).map((item, index) => ({
        ...item,
        id: item.id || item.game_id || `fallback-id-${index}`,
        is_checked: false,
        is_2480: item.is_2480 === true || item.is_2480 === 'true',
      }));
      setMembers(initialized);
    }
  };

  const handleUpdateField = async (gameId: string, id: string, field: keyof MemberItem, value: any) => {
    let dbValue = value;
    if (field === 'is_2480') {
      dbValue = value ? true : false;
    } else if (dbValue === '') {
      dbValue = null;
    }

    let query = supabase.from('members').update({ [field]: dbValue });
    if (gameId) {
      query = query.eq('game_id', gameId);
    } else {
      query = query.eq('id', id);
    }

    const { error } = await query;
    if (error) {
      console.error('Update failed details:', JSON.stringify(error, null, 2));
      alert(`更新に失敗しました: ${error.message || JSON.stringify(error)}`);
    } else {
      setMembers(members.map(m => (m.game_id === gameId || m.id === id) ? { ...m, [field]: value } : m));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const parsePower = (val: string | number | null | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim().toUpperCase();
    let multiplier = 1;
    if (str.endsWith('B')) multiplier = 1_000_000_000;
    else if (str.endsWith('M')) multiplier = 1_000_000;
    else if (str.endsWith('K')) multiplier = 1_000;
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num * multiplier;
  };

  // 各列ごとに存在しうる一意な値のリストを取得（ポップアップの選択肢用）
  const getUniqueValues = (field: keyof MemberItem) => {
    const values = members.map(m => {
      let val = m[field];
      if (field === 'is_2480') {
        return val ? '○' : '-';
      }
      return val !== null && val !== undefined && val !== '' ? String(val) : '(未設定)';
    });
    return Array.from(new Set(values)).sort();
  };

  // フィルター＆ソートの適用
  const filteredAndSortedMembers = useMemo(() => {
    let result = members.filter(m => {
      // グローバル検索
      if (globalSearch) {
        const query = globalSearch.toLowerCase();
        const matchGlobal = 
          String(m.name || '').toLowerCase().includes(query) ||
          String(m.game_id || '').toLowerCase().includes(query) ||
          String(m.rank_role || '').toLowerCase().includes(query);
        if (!matchGlobal) return false;
      }

      // 列ごとのチェックボックスフィルター
      for (const key of Object.keys(columnFilters) as (keyof MemberItem)[]) {
        const selectedValues = columnFilters[key];
        if (selectedValues && selectedValues.length > 0) {
          let val = m[key];
          let displayVal = val !== null && val !== undefined && val !== '' ? String(val) : '(未設定)';
          if (key === 'is_2480') {
            displayVal = val ? '○' : '-';
          }
          if (!selectedValues.includes(displayVal)) {
            return false;
          }
        }
      }

      return true;
    });

    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'current_power') {
          valA = parsePower(valA);
          valB = parsePower(valB);
        } else {
          valA = String(valA || '');
          valB = String(valB || '');
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [members, globalSearch, columnFilters, sortField, sortOrder]);

  const toggleColumnFilterValue = (field: string, val: string) => {
    const current = columnFilters[field] || [];
    if (current.includes(val)) {
      setColumnFilters({ ...columnFilters, [field]: current.filter(item => item !== val) });
    } else {
      setColumnFilters({ ...columnFilters, [field]: [...current, val] });
    }
  };

  const clearColumnFilter = (field: string) => {
    setColumnFilters({ ...columnFilters, [field]: [] });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 flex flex-col relative">
      {/* ヘッダーエリア */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span> GEN メンバー管理
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            同盟「GEN」かつステータスが「active」のメンバー一覧です。カラム名クリックで並び替え、虫眼鏡ボタンで絞り込みを行えます。
          </p>
        </div>
        
        {/* グローバル検索窓 */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="名前、ゲームID、役職で検索..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-500 shadow-inner"
          />
        </div>
      </div>

      {/* テーブル本体 */}
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-x-auto flex-1 max-h-[75vh]">
        <table className="w-full text-left border-collapse min-w-[1500px] table-fixed">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0b0f19] text-[11px] text-slate-400 sticky top-0 z-30 whitespace-nowrap">
              {/* 作業列 */}
              <th className="p-0 sticky left-0 z-30 bg-[#0b0f19] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] w-[230px]">
                <div className="flex items-center">
                  <div className="p-3 font-semibold text-center w-[50px] shrink-0 border-b border-slate-800">作業</div>
                  <div className="p-3 font-semibold w-[180px] shrink-0 border-b border-slate-800 flex items-center justify-between">
                    <span 
                      onClick={() => handleSort('name')}
                      className="cursor-pointer hover:text-cyan-400 flex items-center gap-1 select-none"
                    >
                      アカウント名 (name)
                      <span className="text-[10px] text-slate-400">
                        {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </span>
                  </div>
                </div>
              </th>

              {/* 各カラムヘッダー */}
              {[
                { key: 'game_id', label: 'ゲームID', width: 'w-[120px]' },
                { key: 'rank_role', label: 'rank_role', width: 'w-[110px]' },
                { key: 'fc_level', label: 'FC', width: 'w-[110px]' },
                { key: 'current_power', label: '総力(移民後)', width: 'w-[130px]' },
                { key: 'status_type', label: 'ステータス', width: 'w-[130px]' },
                { key: 'is_2480', label: '2480', width: 'w-[90px]', center: true },
                { key: 'migration_dest', label: '移民・移籍先', width: 'w-[150px]' },
                { key: 'migration_time', label: '移民時期', width: 'w-[120px]' },
                { key: 'remarks', label: '備考', width: 'w-[200px]' },
              ].map((col) => {
                const isFiltered = (columnFilters[col.key] || []).length > 0;
                const isCurrentSorted = sortField === col.key;
                return (
                  <th key={col.key} className={`p-3 font-semibold ${col.width} border-b border-slate-800 relative`}>
                    <div className="flex items-center justify-between select-none">
                      <span 
                        onClick={() => handleSort(col.key as SortField)}
                        className={`cursor-pointer hover:text-cyan-400 flex items-center gap-1.5 ${col.center ? 'w-full justify-center' : ''}`}
                      >
                        <span className="truncate">{col.label}</span>
                        <span className={`text-[10px] ${isCurrentSorted ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
                          {isCurrentSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFilterCol(openFilterCol === col.key ? null : col.key);
                        }}
                        className={`p-1 rounded hover:bg-slate-800 transition shrink-0 ${isFiltered ? 'text-cyan-400 font-bold bg-slate-800/80' : 'text-slate-400'}`}
                        title="絞り込み検索"
                      >
                        🔍
                      </button>
                    </div>

                    {/* フィルターポップアップメニュー */}
                    {openFilterCol === col.key && (
                      <div 
                        ref={filterPopupRef} 
                        className="absolute top-full left-0 mt-1 w-56 bg-[#111726] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-slate-200 text-xs"
                      >
                        <div className="font-bold text-slate-300 pb-2 mb-2 border-b border-slate-700 flex justify-between items-center">
                          <span>絞り込み選択</span>
                          <span className="text-[10px] text-cyan-400">{col.label}</span>
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto space-y-1 mb-3 pr-1">
                          {getUniqueValues(col.key as keyof MemberItem).map(val => {
                            const isSelected = (columnFilters[col.key] || []).length === 0 || (columnFilters[col.key] || []).includes(val);
                            return (
                              <label key={val} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleColumnFilterValue(col.key, val)}
                                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                                />
                                <span className="truncate">{val}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                          <button
                            type="button"
                            onClick={() => clearColumnFilter(col.key)}
                            className="text-[10px] text-slate-400 hover:text-white underline"
                          >
                            すべて解除
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenFilterCol(null)}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-[11px] font-medium transition"
                          >
                            閉じる
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="text-xs whitespace-nowrap">
            {filteredAndSortedMembers.length === 0 ? (
              <tr key="no-members">
                <td colSpan={10} className="text-center py-12 text-slate-500">
                  条件に該当するGENメンバーがいません
                </td>
              </tr>
            ) : (
              filteredAndSortedMembers.map((member, index) => (
                <tr key={member.game_id || `member-${index}`} className="hover:bg-slate-800/30 transition group">
                  <td className="p-0 sticky left-0 z-20 bg-[#151c2c] group-hover:bg-[#1a2338] transition shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-b border-slate-800/60 w-[230px]">
                    <div className="flex items-center">
                      <div className="p-3 text-center w-[50px] shrink-0">
                        <input
                          type="checkbox"
                          checked={member.is_checked || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setMembers(members.map(m => m.game_id === member.game_id ? { ...m, is_checked: checked } : m));
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </div>
                      <div className="p-3 font-bold text-white w-[180px] shrink-0 truncate">
                        {member.name || '-'}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 font-mono text-slate-400 w-[120px] truncate border-b border-slate-800/60">
                    {member.game_id || '-'}
                  </td>

                  <td className="p-3 text-slate-300 w-[110px] truncate border-b border-slate-800/60">
                    {member.rank_role || '-'}
                  </td>

                  {/* FC (fc_level) -> 変更不可（テキスト表示） */}
                  <td className="p-3 font-mono text-slate-200 w-[110px] truncate border-b border-slate-800/60">
                    {member.fc_level || '-'}
                  </td>

                  {/* 総力(移民後) -> 変更不可（テキスト表示） */}
                  <td className="p-3 font-mono text-slate-200 w-[130px] truncate border-b border-slate-800/60">
                    {member.current_power || '-'}
                  </td>

                  {/* ステータス -> プルダウン */}
                  <td className="p-3 w-[130px] border-b border-slate-800/60">
                    <select
                      value={member.status_type || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'status_type', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="">(未選択)</option>
                      {STATUS_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  {/* 2480 -> チェックボックス */}
                  <td className="p-3 w-[90px] text-center border-b border-slate-800/60">
                    <div className="flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={member.is_2480 || false}
                        onChange={(e) => handleUpdateField(member.game_id, member.id!, 'is_2480', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                      />
                    </div>
                  </td>

                  {/* 移民・移籍先 -> 手入力 */}
                  <td className="p-3 w-[150px] border-b border-slate-800/60">
                    <input
                      type="text"
                      defaultValue={member.migration_dest || ''}
                      onBlur={(e) => handleUpdateField(member.game_id, member.id!, 'migration_dest', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-xs"
                      placeholder="入力..."
                    />
                  </td>

                  {/* 移民時期 -> プルダウン */}
                  <td className="p-3 w-[120px] border-b border-slate-800/60">
                    <select
                      value={member.migration_time || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'migration_time', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="">(未選択)</option>
                      {MIGRATION_TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  {/* 備考 -> 手入力 */}
                  <td className="p-3 w-[200px] border-b border-slate-800/60">
                    <input
                      type="text"
                      defaultValue={member.remarks || ''}
                      onBlur={(e) => handleUpdateField(member.game_id, member.id!, 'remarks', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-xs"
                      placeholder="入力..."
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}