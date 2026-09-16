'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface MemberItem {
  id?: string;
  is_checked?: boolean;
  name: string;
  game_id: string;
  rank_role: string;
  fc_level: string;
  shield_soldier: string;
  spear_soldier: string;
  bow_soldier: string;
  power_before_migration: string | number;
  current_power: string | number;
  gen_discord: boolean;
  info_sharing: boolean;
  bear: string;
}

const FC_OPTIONS = ['FC10', 'FC9', 'FC8', 'FC7', 'FC6以下'];
const SOLDIER_OPTIONS = ['FC10T11', 'FC9T11', 'FC8T11', 'FC7T11', 'FC6T11', 'FC5T11', 'FC10T10', 'FC9T10', 'FC8T10', 'FC7T10', 'FC6T10以下'];
const BEAR_OPTIONS = ['21時', '23時', '21/23時両方'];

type SortField = 'name' | 'game_id' | 'fc_level' | 'current_power' | 'power_before_migration';
type SortOrder = 'asc' | 'desc';

export default function GenMemberManagementPage() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchGameId, setSearchGameId] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchGenMembers();
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
        gen_discord: item.gen_discord === true || item.gen_discord === 'true',
        info_sharing: item.info_sharing === true || item.info_sharing === 'true',
      }));
      setMembers(initialized);
    }
  };

  // game_id または id をキーにして更新する
  const handleUpdateField = async (gameId: string, id: string, field: keyof MemberItem, value: any) => {
    let dbValue = value;
    if (field === 'gen_discord' || field === 'info_sharing') {
      dbValue = value ? 'true' : 'false';
    } else if (dbValue === '') {
      dbValue = null;
    }

    // game_id を優先して条件に使用（idがないテーブル構造に対応）
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

  const filteredAndSortedMembers = useMemo(() => {
    let result = members.filter(m => {
      const matchName = String(m.name || '').toLowerCase().includes(searchName.toLowerCase());
      const matchGameId = String(m.game_id || '').toLowerCase().includes(searchGameId.toLowerCase());
      return matchName && matchGameId;
    });

    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'current_power' || sortField === 'power_before_migration') {
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
  }, [members, searchName, searchGameId, sortField, sortOrder]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-6 flex flex-col">
      <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span> GEN メンバー管理
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            同盟「GEN」かつステータスが「active」のメンバー一覧です。
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="アカウント名で検索..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500 shadow"
          />
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="ゲームIDで検索..."
            value={searchGameId}
            onChange={(e) => setSearchGameId(e.target.value)}
            className="w-full bg-[#151c2c] border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-cyan-500 shadow"
          />
        </div>
      </div>

      <div className="bg-[#151c2c] border border-slate-800 rounded-xl shadow-xl overflow-x-auto flex-1 max-h-[70vh]">
        <table className="w-full text-left border-collapse min-w-[1600px] table-fixed">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0b0f19] text-[11px] text-slate-400 sticky top-0 z-30 whitespace-nowrap">
              <th className="p-0 sticky left-0 z-30 bg-[#0b0f19] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] w-[230px]">
                <div className="flex items-center">
                  <div className="p-3 font-semibold text-center w-[50px] shrink-0 border-b border-slate-800">作業</div>
                  <div 
                    onClick={() => handleSort('name')} 
                    className="p-3 font-semibold w-[180px] shrink-0 border-b border-slate-800 cursor-pointer hover:text-cyan-400 flex items-center justify-between"
                  >
                    <span>アカウント名 (name)</span>
                    <span>{sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </div>
              </th>
              
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">ゲームID</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">rank_role</th>
              
              <th 
                onClick={() => handleSort('fc_level')}
                className="p-3 font-semibold w-[110px] border-b border-slate-800 cursor-pointer hover:text-cyan-400"
              >
                <div className="flex items-center justify-between">
                  <span>FC (fc_level)</span>
                  <span>{sortField === 'fc_level' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                </div>
              </th>

              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">盾 (shield)</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">槍 (spear)</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800">弓 (bow)</th>

              <th 
                onClick={() => handleSort('power_before_migration')}
                className="p-3 font-semibold w-[120px] border-b border-slate-800 cursor-pointer hover:text-cyan-400"
              >
                <div className="flex items-center justify-between">
                  <span>総力(移民前)</span>
                  <span>{sortField === 'power_before_migration' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                </div>
              </th>

              <th 
                onClick={() => handleSort('current_power')}
                className="p-3 font-semibold w-[120px] border-b border-slate-800 cursor-pointer hover:text-cyan-400"
              >
                <div className="flex items-center justify-between">
                  <span>総力(移民後)</span>
                  <span>{sortField === 'current_power' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                </div>
              </th>

              <th className="p-3 font-semibold w-[110px] border-b border-slate-800 text-center">GEN Discord</th>
              <th className="p-3 font-semibold w-[110px] border-b border-slate-800 text-center">情報共有</th>
              <th className="p-3 font-semibold w-[130px] border-b border-slate-800">クマ罠 (bear)</th>
            </tr>
          </thead>

          <tbody className="text-xs whitespace-nowrap">
            {filteredAndSortedMembers.length === 0 ? (
              <tr key="no-members">
                <td colSpan={12} className="text-center py-12 text-slate-500">
                  該当するGENメンバーがいません
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

                  <td className="p-3 font-mono text-slate-400 w-[110px] truncate border-b border-slate-800/60">
                    {member.game_id || '-'}
                  </td>

                  <td className="p-3 text-slate-300 w-[110px] truncate border-b border-slate-800/60">
                    {member.rank_role || '-'}
                  </td>

                  <td className="p-3 w-[110px] border-b border-slate-800/60">
                    <select
                      value={member.fc_level || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'fc_level', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500"
                    >
                      <option value="">-</option>
                      {FC_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  <td className="p-3 w-[110px] border-b border-slate-800/60">
                    <select
                      value={member.shield_soldier || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'shield_soldier', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-[11px]"
                    >
                      <option value="">-</option>
                      {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  <td className="p-3 w-[110px] border-b border-slate-800/60">
                    <select
                      value={member.spear_soldier || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'spear_soldier', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-[11px]"
                    >
                      <option value="">-</option>
                      {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  <td className="p-3 w-[110px] border-b border-slate-800/60">
                    <select
                      value={member.bow_soldier || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'bow_soldier', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-[11px]"
                    >
                      <option value="">-</option>
                      {SOLDIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>

                  <td className="p-3 w-[120px] border-b border-slate-800/60">
                    <input
                      type="text"
                      defaultValue={member.power_before_migration || ''}
                      onBlur={(e) => handleUpdateField(member.game_id, member.id!, 'power_before_migration', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </td>

                  <td className="p-3 w-[120px] border-b border-slate-800/60">
                    <input
                      type="text"
                      defaultValue={member.current_power || ''}
                      onBlur={(e) => handleUpdateField(member.game_id, member.id!, 'current_power', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </td>

                  <td className="p-3 w-[110px] text-center border-b border-slate-800/60">
                    <div className="flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={member.gen_discord}
                        onChange={(e) => handleUpdateField(member.game_id, member.id!, 'gen_discord', e.target.checked)}
                        className={`w-4 h-4 rounded border cursor-pointer transition ${
                          member.gen_discord
                            ? 'bg-emerald-500 border-emerald-400 text-white accent-emerald-500'
                            : 'bg-slate-900 border-slate-700 text-slate-500'
                        }`}
                      />
                    </div>
                  </td>

                  <td className="p-3 w-[110px] text-center border-b border-slate-800/60">
                    <div className="flex justify-center items-center">
                      <input
                        type="checkbox"
                        checked={member.info_sharing}
                        onChange={(e) => handleUpdateField(member.game_id, member.id!, 'info_sharing', e.target.checked)}
                        className={`w-4 h-4 rounded border cursor-pointer transition ${
                          member.info_sharing
                            ? 'bg-emerald-500 border-emerald-400 text-white accent-emerald-500'
                            : 'bg-slate-900 border-slate-700 text-slate-500'
                        }`}
                      />
                    </div>
                  </td>

                  <td className="p-3 w-[130px] border-b border-slate-800/60">
                    <select
                      value={member.bear || ''}
                      onChange={(e) => handleUpdateField(member.game_id, member.id!, 'bear', e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded p-1 text-slate-200 outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="">(未選択)</option>
                      {BEAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
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