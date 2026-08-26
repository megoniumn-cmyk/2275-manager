// app/members/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Member {
  discord_id: string;
  name: string;
  game_id?: string;
  main_game_id?: string;
  alliance?: string | null;
  rank_role?: string;
  fc_level?: string;
  shield_soldier?: string;
  spear_soldier?: string;
  bow_soldier?: string;
  leader?: boolean;
  power_before_migration?: string;
  current_power?: string;
  transfer?: string;
  state?: string;
  status?: string;
  is_hidden?: boolean;
  is_in_2275?: boolean;
  info_sharing?: boolean;
  discord_checked?: boolean;
  note?: string;
  updated_at?: string;
  planet?: number;
  hero_hendrik?: number;
  hero_gatto?: number;
  hero_gordon?: number;
  hero_muming?: number;
  hero_renee?: number;
  hero_norah?: number;
  hero_mia?: number;
  hero_phily?: number;
  hero_zinman?: number;
  gareth_2?: number;
  gareth_3?: number;
  gareth_4?: number;
  gen_discord?: boolean;
  bear?: string;
  [key: string]: any;
}

export type SortKey =
  | 'work_checked_str'
  | 'name'
  | 'game_id'
  | 'main_game_id_name'
  | 'alliance'
  | 'rank_role'
  | 'fc_level'
  | 'shield_soldier'
  | 'spear_soldier'
  | 'bow_soldier'
  | 'leader'
  | 'power_before_migration'
  | 'current_power'
  | 'transfer'
  | 'state'
  | 'status'
  | 'banned_str'
  | 'access_str'
  | 'is_in_2275_str'
  | 'note'
  | 'updated_at';

const EXCLUDE_DISCORD_IDS = [
  '916300992612540467',
  '1445732867895201923',
  '917633605684056085',
  '1263059654917750784',
  '1154813675803263076',
];

// ★ 追加: どんな型や文字列で入っていても安全に真偽値を判定する厳密なパーサー
const parseBoolean = (val: any): boolean => {
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === 't' || lower === 'yes' || lower === 'y' || lower === '○' || lower === '〇') {
      return true;
    }
  }
  return false;
};

export default function MembersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [profileBannedMap, setProfileBannedMap] = useState<Record<string, boolean>>({});
  const [transferOptions, setTransferOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPastMembers, setShowPastMembers] = useState(false);
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [newTransferLabel, setNewTransferLabel] = useState('');

  const [isDiscordCheckModalOpen, setIsDiscordCheckModalOpen] = useState(false);
  const [discordCheckRows, setDiscordCheckRows] = useState<Record<string, boolean>>({});

  const [sortKey, setSortKey] = useState<SortKey>('rank_role');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const memberFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('supabase_user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchData = async () => {
    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .order('rank_role', { ascending: true });
    
    if (memberData) {
      // ★ 厳密な parseBoolean を使って安全に正規化
      const normalized = memberData.map((m) => ({
        ...m,
        is_in_2275: parseBoolean(m.is_in_2275),
        leader: parseBoolean(m.leader),
        discord_checked: parseBoolean(m.discord_checked),
        is_hidden: parseBoolean(m.is_hidden),
      }));
      setMembers(normalized);
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('game_id, banned');
    if (profileData) {
      const bMap: Record<string, boolean> = {};
      profileData.forEach((p) => {
        if (p.game_id) {
          bMap[String(p.game_id)] = !!p.banned;
        }
      });
      setProfileBannedMap(bMap);
    }

    const { data: transferData } = await supabase
      .from('transfer_options')
      .select('label')
      .order('created_at', { ascending: true });
    if (transferData) {
      setTransferOptions(transferData.map((t) => t.label));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uncheckDiscordMembers = useMemo(() => {
    return members.filter((m) => m.status === 'left' && !m.discord_checked);
  }, [members]);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      if (m.game_id) map.set(String(m.game_id).trim(), m.name);
      if (m.discord_id) map.set(String(m.discord_id).trim(), m.name);
    });
    return map;
  }, [members]);

  const getMainAccountName = (mainGameId?: string) => {
    if (!mainGameId) return '-';
    const trimmed = String(mainGameId).trim();
    return memberNameMap.get(trimmed) || trimmed;
  };

  const existingStateOptions = useMemo(() => {
    const statesSet = new Set<string>();
    members.forEach((m) => {
      if (m.state) {
        m.state.split(',').forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) statesSet.add(trimmed);
        });
      }
    });
    return Array.from(statesSet).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
  }, [members]);

  const getMemberValue = (member: Member, key: string): string => {
    if (key === 'work_checked_str') {
      return checkedRows[member.discord_id] ? 'チェックあり' : 'チェックなし';
    }
    if (key === 'is_in_2275_str') {
      return parseBoolean(member.is_in_2275) ? '○' : '-';
    }
    if (key === 'leader') {
      return parseBoolean(member.leader) ? '〇' : '-';
    }
    if (key === 'status') {
      return member.status === 'left' ? '除名' : '在籍中';
    }
    if (key === 'banned_str') {
      const isBanned = member.game_id ? profileBannedMap[member.game_id] : false;
      return isBanned ? '制限中' : '通常';
    }
    if (key === 'main_game_id_name') {
      return getMainAccountName(member.main_game_id);
    }
    if (key === 'access_str') {
      return member.is_hidden ? '制限' : '許可';
    }
    if (key === 'updated_at') {
      if (!member.updated_at) return '未設定/空欄';
      const d = new Date(member.updated_at);
      if (isNaN(d.getTime())) return String(member.updated_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd}`;
    }
    const val = member[key as keyof Member];
    if (val === null || val === undefined || val === '') return '未設定/空欄';
    return String(val);
  };

  const getColumnOptions = (key: string) => {
    const options = new Set<string>();
    if (key === 'work_checked_str') {
      return ['チェックあり', 'チェックなし'];
    }
    if (key === 'state') {
      let hasEmpty = false;
      members.forEach((m) => {
        if (!m.state || m.state.trim() === '') {
          hasEmpty = true;
        } else {
          m.state.split(',').forEach((s) => {
            const trimmed = s.trim();
            if (trimmed) options.add(trimmed);
          });
        }
      });
      const sorted = Array.from(options).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
      if (hasEmpty) sorted.push('未設定/空欄');
      return sorted;
    }

    members.forEach((m) => {
      options.add(getMemberValue(m, key));
    });
    return Array.from(options).sort((a, b) => b.localeCompare(a, 'ja', { numeric: true }));
  };

  const processedMembers = useMemo(() => {
    let result = members
      .filter((m) => !m.is_hidden)
      .filter((m) => {
        const isLeft = m.status === 'left';
        return showPastMembers ? isLeft : !isLeft;
      })
      .filter(
        (m) =>
          m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.rank_role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.game_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.main_game_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          getMainAccountName(m.main_game_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.alliance?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    Object.keys(columnFilters).forEach((key) => {
      const selectedValues = columnFilters[key];
      if (selectedValues && selectedValues.length > 0) {
        if (key === 'state') {
          result = result.filter((m) => {
            const memberStates = m.state ? m.state.split(',').map((s) => s.trim()) : [];
            const isUnset = memberStates.length === 0;
            if (selectedValues.includes('未設定/空欄') && isUnset) return true;
            return selectedValues.some((val) => memberStates.includes(val));
          });
        } else {
          result = result.filter((m) => selectedValues.includes(getMemberValue(m, key)));
        }
      }
    });

    return [...result].sort((a, b) => {
      let aVal: any = 
        sortKey === 'work_checked_str' ? (checkedRows[a.discord_id] ? 'チェックあり' : 'チェックなし') :
        sortKey === 'is_in_2275_str' ? (parseBoolean(a.is_in_2275) ? '○' : '-') : 
        sortKey === 'leader' ? (parseBoolean(a.leader) ? '〇' : '-') : 
        sortKey === 'status' ? (a.status === 'left' ? '除名' : '在籍中') :
        sortKey === 'banned_str' ? ((a.game_id && profileBannedMap[a.game_id]) ? '制限中' : '通常') :
        sortKey === 'main_game_id_name' ? getMainAccountName(a.main_game_id) :
        sortKey === 'updated_at' ? getMemberValue(a, 'updated_at') :
        a[sortKey as keyof Member];
      let bVal: any = 
        sortKey === 'work_checked_str' ? (checkedRows[b.discord_id] ? 'チェックあり' : 'チェックなし') :
        sortKey === 'is_in_2275_str' ? (parseBoolean(b.is_in_2275) ? '○' : '-') : 
        sortKey === 'leader' ? (parseBoolean(b.leader) ? '〇' : '-') : 
        sortKey === 'status' ? (b.status === 'left' ? '除名' : '在籍中') :
        sortKey === 'banned_str' ? ((b.game_id && profileBannedMap[b.game_id]) ? '制限中' : '通常') :
        sortKey === 'main_game_id_name' ? getMainAccountName(b.main_game_id) :
        sortKey === 'updated_at' ? getMemberValue(b, 'updated_at') :
        b[sortKey as keyof Member];

      if (aVal === null || aVal === undefined || aVal === '') return 1;
      if (bVal === null || bVal === undefined || bVal === '') return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const cmp = String(aVal).localeCompare(String(bVal), 'ja', { numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [members, searchTerm, columnFilters, sortKey, sortOrder, profileBannedMap, showPastMembers, memberNameMap, checkedRows]);

  const toggleFilterValue = (key: string, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[key] || [];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: updated };
    });
  };

  const clearFilter = (key: string) => {
    setColumnFilters((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleMarkDiscordChecked = async (discordId: string) => {
    const { error } = await supabase
      .from('members')
      .update({ discord_checked: true })
      .eq('discord_id', discordId);

    if (error) {
      alert('更新に失敗しました: ' + error.message);
      return;
    }
    fetchData();
  };

  const handleBatchMarkDiscordChecked = async () => {
    const targetDiscordIds = Object.keys(discordCheckRows).filter((id) => discordCheckRows[id]);
    if (targetDiscordIds.length === 0) {
      alert('確認完了にするメンバーを選択してください');
      return;
    }

    const { error } = await supabase
      .from('members')
      .update({ discord_checked: true })
      .in('discord_id', targetDiscordIds);

    if (error) {
      alert('一括更新に失敗しました: ' + error.message);
      return;
    }

    setDiscordCheckRows({});
    alert(`${targetDiscordIds.length}件のDiscord確認を完了しました`);
    fetchData();
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editingMember.discord_id) return;

    const payloadToSave = {
      ...editingMember,
      transfer: editingMember.transfer === '' ? null : editingMember.transfer,
      is_in_2275: parseBoolean(editingMember.is_in_2275),
      leader: parseBoolean(editingMember.leader),
      discord_checked: parseBoolean(editingMember.discord_checked),
    };

    const { data: dbCurrent } = await supabase
      .from('members')
      .select('*')
      .eq('discord_id', editingMember.discord_id)
      .maybeSingle();

    let isChanged = false;
    if (dbCurrent) {
      for (const key of Object.keys(payloadToSave)) {
        if (key === 'updated_at') continue;
        if ((payloadToSave as Record<string, any>)[key] !== dbCurrent[key]) {
          isChanged = true;
          break;
        }
      }
    } else {
      isChanged = true;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      ...payloadToSave,
      updated_at: isChanged ? nowIso : (dbCurrent?.updated_at || nowIso),
    };

    let error;
    if (dbCurrent) {
      const res = await supabase
        .from('members')
        .update(payload)
        .eq('discord_id', editingMember.discord_id);
      error = res.error;
    } else {
      const res = await supabase
        .from('members')
        .insert([payload]);
      error = res.error;
    }

    if (error) {
      return alert('保存に失敗しました: ' + error.message);
    }

    setEditingMember(null);
    fetchData();
  };

  const handleDiscordSync = async () => {
    try {
      const response = await fetch('/api/discord/sync', {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Discord連携に失敗しました。');
      }

      alert(`Discord連携が完了しました！（更新: ${result.updatedCount || 0}件）`);
      fetchData();
    } catch (err: any) {
      alert('Discord連携に失敗しました: ' + (err.message || err));
    }
  };

  const handleSyncProfiles = async () => {
    try {
      const { data: memberList, error: mError } = await supabase
        .from('members')
        .select('discord_id, game_id, name, rank_role, status')
        .limit(5000);

      if (mError) {
        alert('membersテーブルの取得に失敗しました: ' + mError.message);
        return;
      }
      
      if (!memberList || memberList.length === 0) {
        alert('membersテーブルにデータが見つかりませんでした。');
        return;
      }

      const { data: existingProfiles, error: pError } = await supabase
        .from('profiles')
        .select('game_id')
        .limit(5000);
      
      if (pError) {
        alert('profilesテーブルの取得に失敗しました: ' + pError.message);
        return;
      }

      const existingGameIds = new Set(
        existingProfiles?.map(p => String(p.game_id).trim()).filter(Boolean)
      );

      const newProfilesToInsert = [];

      for (const member of memberList) {
        if (!member.game_id) continue;
        if (member.discord_id && EXCLUDE_DISCORD_IDS.includes(String(member.discord_id))) continue;

        const memberGameIdStr = String(member.game_id).trim();
        if (existingGameIds.has(memberGameIdStr)) continue;

        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
        const statusVal = (member.status || '').trim().toLowerCase();
        const isBanned = statusVal === 'left';

        newProfilesToInsert.push({
          id: crypto.randomUUID(),
          discord_id: member.discord_id || null,
          game_id: member.game_id,
          name: member.name || null,
          password: randomPassword,
          web_role: 'member',
          rank_role: member.rank_role || 'R1',
          created_at: new Date().toISOString(),
          banned: isBanned,
        });

        existingGameIds.add(memberGameIdStr);
      }

      if (newProfilesToInsert.length === 0) {
        alert('追加すべき新規メンバーはありませんでした。（全員登録済みです）');
        return;
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .insert(newProfilesToInsert);

      if (insertError) {
        alert('プロファイルの登録に失敗しました: ' + insertError.message);
        return;
      }

      alert(`同期が完了しました。\n新規追加: ${newProfilesToInsert.length} 件`);
      fetchData();
    } catch (err: any) {
      alert('エラーが発生しました: ' + (err.message || JSON.stringify(err)));
    }
  };

  const downloadCSV = (filename: string, headers: string[], rows: any[]) => {
    const csvRows = [headers.join(',')];
    rows.forEach((row) => {
      const line = headers.map((key) => {
        let val = row[key];
        if (val === null || val === undefined) val = '';
        const strVal = String(val);
        const escaped = strVal.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(line.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMembersCSV = () => {
    if (processedMembers.length === 0) return alert('出力するデータがありません');
    const headers = [
      'name', 'game_id', 'main_game_id', 'alliance', 'rank_role', 'fc_level',
      'shield_soldier', 'spear_soldier', 'bow_soldier', 'leader',
      'power_before_migration', 'current_power', 'transfer', 'state',
      'is_in_2275', 'status', 'discord_checked', 'note', 'updated_at'
    ];
    downloadCSV(`members_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, processedMembers);
  };

  const parseCSVRows = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return null;

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result.map((v) => v.replace(/^"|"$/g, '').trim());
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      rows.push({ headers, values });
    }
    return { headers, rows };
  };

  const handleImportMembersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSVRows(text);
      if (!parsed) return alert('CSVデータが正しくありません');

      const nowIso = new Date().toISOString();
      const csvMap = new Map<string, any>();

      for (const { headers, values } of parsed.rows) {
        const rowData: any = {};
        headers.forEach((header, index) => {
          let val: any = values[index] ?? null;
          if (val === '' || val === '未設定' || val === '未設定/空欄' || val === 'nan') {
            val = null;
          }
          if (header === 'leader' || header === 'is_in_2275' || header === 'discord_checked') {
            val = parseBoolean(val);
          }
          rowData[header] = val;
        });

        if (rowData.discord_id && EXCLUDE_DISCORD_IDS.includes(String(rowData.discord_id))) {
          continue;
        }

        if (rowData.name) {
          if (!rowData.discord_id || String(rowData.discord_id).trim() === "") {
            rowData.discord_id = rowData.game_id 
              ? `no_discord_gameid_${rowData.game_id}` 
              : `temp_${Math.random().toString(36).substring(2, 11)}`;
          }
          const uniqueKey = rowData.game_id ? `game_${rowData.game_id}` : `discord_${rowData.discord_id}`;
          csvMap.set(uniqueKey, rowData);
        }
      }

      let successCount = 0;
      for (const [, csvRow] of csvMap) {
        const { data: existing } = await supabase
          .from('members')
          .select('*')
          .eq('discord_id', csvRow.discord_id)
          .maybeSingle();

        const payload = {
          ...csvRow,
          updated_at: nowIso,
        };

        let error;
        if (existing) {
          const res = await supabase
            .from('members')
            .update(payload)
            .eq('discord_id', csvRow.discord_id);
          error = res.error;
        } else {
          const res = await supabase
            .from('members')
            .insert([payload]);
          error = res.error;
        }

        if (error) {
          console.error('CSVインポートエラー:', error.message);
        } else {
          successCount++;
        }
      }

      alert(`CSVの取り込みが完了しました（成功件数: ${successCount}件）`);
      setEditingMember(null);
      fetchData();
    };
    reader.readAsText(file);
  };

  const handleAddTransferOption = async () => {
    if (!newTransferLabel.trim()) {
      alert('移民時期の名称を入力してください');
      return;
    }
    try {
      const { error } = await supabase
        .from('transfer_options')
        .insert([{ label: newTransferLabel.trim() }]);

      if (error) throw error;
      alert('移民時期の選択項目を追加しました');
      setNewTransferLabel('');
      fetchData();
    } catch (err: any) {
      alert('追加に失敗しました: ' + err.message);
    }
  };

  const HeaderCell = ({ title, fieldKey, className = '' }: { title: string; fieldKey: string; className?: string }) => {
    const isFiltered = (columnFilters[fieldKey] || []).length > 0;
    const options = getColumnOptions(fieldKey);
    const isOpen = activeFilterMenu === fieldKey;

    return (
      <th className={`p-3 relative border-r border-slate-800/50 select-none bg-[#1e293b] ${className}`}>
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => handleSort(fieldKey as SortKey)}
            className="flex items-center gap-1 font-semibold hover:text-white transition flex-1 text-left"
          >
            <span>{title}</span>
            {sortKey === fieldKey ? (
              <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
            ) : (
              <span className="text-slate-600 text-[10px]">↕</span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveFilterMenu(isOpen ? null : fieldKey);
            }}
            className={`p-1 rounded hover:bg-slate-700 transition ${
              isFiltered ? 'bg-cyan-600/30 text-cyan-400 font-bold' : 'text-slate-500'
            }`}
            title="項目で絞り込み"
          >
            🔍
          </button>
        </div>

        {isOpen && (
          <div
            className="absolute left-0 top-full mt-1 w-48 bg-[#1e293b] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-xs normal-case font-normal text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-700 mb-2">
              <span className="font-bold text-slate-300">絞り込み選択</span>
              {isFiltered && (
                <button onClick={() => clearFilter(fieldKey)} className="text-[10px] text-rose-400 hover:underline">
                  解除
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {options.map((opt) => {
                const checked = (columnFilters[fieldKey] || []).includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 hover:bg-slate-800 p-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterValue(fieldKey, opt)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={() => setActiveFilterMenu(null)}
              className="w-full mt-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-center"
            >
              閉じる
            </button>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col" onClick={() => setActiveFilterMenu(null)}>
      <main className="flex-1 max-w-[1900px] mx-auto p-6 w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#151c2c] border border-slate-800 rounded-xl p-6 shadow-xl gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold flex items-center gap-2 text-white">📋 メンバーリスト管理</h1>
              {currentUser && (
                <span className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                  ログイン中: <strong className="text-cyan-400">{currentUser.name || currentUser.game_id}</strong> (Role: {currentUser.web_role})
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">メンバーの一覧確認、詳細データの編集、CSV入出力を行います。</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsDiscordCheckModalOpen(true)}
              className="relative px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition shadow flex items-center gap-2"
            >
              <span>🚨 除名Discord確認</span>
              {uncheckDiscordMembers.length > 0 && (
                <span className="bg-white text-rose-600 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
                  {uncheckDiscordMembers.length}
                </span>
              )}
            </button>

            <button
              onClick={handleDiscordSync}
              className="px-3.5 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition shadow"
            >
              🤖 Discord連携
            </button>
            <button
              onClick={handleSyncProfiles}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition shadow"
            >
              🔄 Profiles同期
            </button>
            <button
              onClick={handleExportMembersCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition shadow"
            >
              📥 メンバーCSV出力
            </button>
            <label className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition shadow cursor-pointer">
              📤 メンバーCSV取込
              <input
                ref={memberFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportMembersCSV}
                className="hidden"
              />
            </label>
            <button
              onClick={() => {
                setEditingMember({
                  discord_id: `temp_${Math.random().toString(36).substring(2, 11)}`,
                  name: '',
                  rank_role: 'R1',
                  alliance: '',
                  fc_level: 'FC6 以下',
                  planet: 1,
                  leader: false,
                  game_id: '',
                  main_game_id: '',
                  shield_soldier: 'FC6T10以下',
                  spear_soldier: 'FC6T10以下',
                  bow_soldier: 'FC6T10以下',
                  power_before_migration: '',
                  current_power: '',
                  transfer: '',
                  bear: '21時',
                  state: '',
                  status: 'active',
                  discord_checked: false,
                  hero_hendrik: 0,
                  hero_gatto: 0,
                  hero_gordon: 0,
                  hero_muming: 0,
                  hero_renee: 0,
                  hero_norah: 0,
                  hero_mia: 0,
                  hero_phily: 0,
                  hero_zinman: 0,
                  gareth_2: 0,
                  gareth_3: 0,
                  gareth_4: 0,
                  gen_discord: false,
                  is_in_2275: false,
                  info_sharing: false,
                  note: '',
                  updated_at: new Date().toISOString()
                });
              }}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition shadow"
            >
              ➕ 新規登録
            </button>
            
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow"
            >
              ➕ 移民時期追加
            </button>

            <button
              onClick={() => setShowPastMembers(!showPastMembers)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition shadow border ${
                showPastMembers
                  ? 'bg-rose-700 text-white border-rose-600'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {showPastMembers ? '👥 在籍中メンバーを表示' : '📁 過去メンバー（非在籍）'}
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="名前、ゲームID、メインアカウント、役職、同盟で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#151c2c] border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500"
        />

        <div className="overflow-y-auto max-h-[75vh] border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1e293b] text-slate-300 uppercase border-b border-slate-800 whitespace-nowrap sticky top-0 z-30">
              <tr>
                <HeaderCell
                  title="作業"
                  fieldKey="work_checked_str"
                  className="sticky left-0 z-30 bg-[#1e293b] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] w-16 min-w-[64px]"
                />
                <HeaderCell
                  title="ゲームアカウント名"
                  fieldKey="name"
                  className="sticky left-[64px] z-30 bg-[#1e293b] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] min-w-[140px]"
                />
                <HeaderCell title="ゲームID" fieldKey="game_id" />
                <HeaderCell title="同盟名" fieldKey="alliance" />
                <HeaderCell title="Role" fieldKey="rank_role" />
                <HeaderCell title="FC" fieldKey="fc_level" />
                <HeaderCell title="盾兵" fieldKey="shield_soldier" />
                <HeaderCell title="槍兵" fieldKey="spear_soldier" />
                <HeaderCell title="弓兵" fieldKey="bow_soldier" />
                <HeaderCell title="リーダー" fieldKey="leader" />
                <HeaderCell title="総力(移民前)" fieldKey="power_before_migration" />
                <HeaderCell title="総力(現在)" fieldKey="current_power" />
                <HeaderCell title="移民時期" fieldKey="transfer" />
                <HeaderCell title="元鯖" fieldKey="state" />
                <HeaderCell title="ステータス" fieldKey="status" />
                <HeaderCell title="アクセス制限" fieldKey="banned_str" />
                <HeaderCell title="メインアカウント" fieldKey="main_game_id_name" />
                <HeaderCell title="Discord(2275)" fieldKey="is_in_2275_str" />
                <HeaderCell title="備考" fieldKey="note" />
                <HeaderCell title="最終更新日時" fieldKey="updated_at" />
                <th className="p-3 text-center bg-[#1e293b]">編集ボタン</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 whitespace-nowrap">
              {processedMembers.map((member) => {
                const isLeft = member.status === 'left';
                const isIn2275 = parseBoolean(member.is_in_2275); // 念のためここでも安全に判定
                return (
                  <tr key={member.discord_id || member.game_id} className="hover:bg-slate-800/50 transition">
                    <td className="p-3 text-center sticky left-0 z-20 bg-[#151c2c] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] w-16 min-w-[64px]">
                      <input
                        type="checkbox"
                        checked={!!checkedRows[member.discord_id]}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setCheckedRows((prev) => ({
                            ...prev,
                            [member.discord_id]: isChecked,
                          }));
                        }}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-medium text-white sticky left-[64px] z-20 bg-[#151c2c] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] min-w-[140px]">
                      {member.name}
                    </td>
                    <td className="p-3 text-slate-300">{member.game_id || '-'}</td>
                    <td className="p-3 font-bold text-indigo-400">{member.alliance || '-'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-700 rounded font-bold text-slate-300">
                        {member.rank_role || '-'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{member.fc_level || '-'}</td>
                    <td className="p-3 text-emerald-400 font-medium">{member.shield_soldier || '-'}</td>
                    <td className="p-3 text-emerald-400 font-medium">{member.spear_soldier || '-'}</td>
                    <td className="p-3 text-emerald-400 font-medium">{member.bow_soldier || '-'}</td>
                    <td className="p-3 text-center">{parseBoolean(member.leader) ? '〇' : '-'}</td>
                    <td className="p-3 text-slate-300">{member.power_before_migration || '-'}</td>
                    <td className="p-3 text-slate-300">{member.current_power || '-'}</td>
                    <td className="p-3 text-slate-300">{member.transfer || '-'}</td>
                    <td className="p-3 text-cyan-300 font-mono">{member.state || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isLeft ? 'bg-rose-900/50 text-rose-300' : 'bg-emerald-900/50 text-emerald-300'
                      }`}>
                        {isLeft ? '除名' : '在籍中'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {isLeft ? (
                        <span className="px-2 py-0.5 bg-rose-600/30 text-rose-400 rounded text-[11px] font-bold">アクセス拒否</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-600/30 text-emerald-400 rounded text-[11px] font-bold">アクセス許可</span>
                      )}
                    </td>
                    <td className="p-3 text-cyan-400">{getMainAccountName(member.main_game_id)}</td>
                    <td className="p-3 text-center">{isIn2275 ? '○' : '-'}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{member.note || '-'}</td>
                    <td className="p-3 text-slate-400 text-xs">
                      {getMemberValue(member, 'updated_at')}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setEditingMember(member)}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow transition"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isDiscordCheckModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[#151c2c] border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🚨 Discord除名・ロール変更確認リスト</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ステータスが「除名」かつDiscord確認が未完了のメンバーです。対応後に「確認完了」を押してください。
                  </p>
                </div>
                <button
                  onClick={() => setIsDiscordCheckModalOpen(false)}
                  className="text-slate-400 hover:text-white font-bold text-lg px-2"
                >
                  ✕
                </button>
              </div>

              <div className="flex justify-between items-center bg-[#0b0f19] p-3 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-300">
                  未確認メンバー数: <strong className="text-rose-400">{uncheckDiscordMembers.length} 件</strong>
                </span>
                {uncheckDiscordMembers.length > 0 && (
                  <button
                    onClick={handleBatchMarkDiscordChecked}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition shadow"
                  >
                    ☑ 選択したメンバーを一括で確認完了にする
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {uncheckDiscordMembers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    現在、確認待ちの除名メンバーはいません 🎉
                  </div>
                ) : (
                  uncheckDiscordMembers.map((m) => (
                    <div
                      key={m.discord_id}
                      className="flex items-center justify-between bg-[#0b0f19] border border-slate-800 hover:border-slate-700 p-3 rounded-xl transition gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!discordCheckRows[m.discord_id]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDiscordCheckRows((prev) => ({
                              ...prev,
                              [m.discord_id]: checked,
                            }));
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-xs text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded">
                              {m.alliance || '同盟なし'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex gap-3 mt-1">
                            <span>ゲームID: <strong className="text-slate-200">{m.game_id || '-'}</strong></span>
                            <span>Discord ID: <strong className="text-slate-200">{m.discord_id}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleMarkDiscordChecked(m.discord_id)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition shadow shrink-0"
                      >
                        確認完了
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsDiscordCheckModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
            <div className="bg-[#151c2c] border border-slate-700 rounded-2xl w-full max-w-4xl p-6 md:p-8 shadow-2xl my-8 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {editingMember.discord_id?.startsWith('temp_') ? 'メンバー新規登録' : 'メンバー情報編集'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveMember} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">ゲームアカウント名 *</label>
                    <input
                      type="text"
                      required
                      value={editingMember.name || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">ゲームID</label>
                    <input
                      type="text"
                      value={editingMember.game_id || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, game_id: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">メインアカウント (選択・検索)</label>
                    <input
                      type="text"
                      list="members-search-list"
                      value={editingMember.main_game_id || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, main_game_id: e.target.value })}
                      placeholder="名前かgame_idで検索・入力"
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                    <datalist id="members-search-list">
                      {Array.from(
                        new Map(
                          members.map((m) => [
                            m.game_id || m.discord_id, 
                            m
                          ])
                        ).values()
                      ).map((m) => {
                        const displayValue = m.game_id || m.name;
                        if (!displayValue) return null;
                        const label = m.name && m.game_id ? `${m.name} (ID: ${m.game_id})` : m.name || m.game_id;
                        return (
                          <option key={m.discord_id || m.game_id} value={displayValue}>
                            {label}
                          </option>
                        );
                      })}
                    </datalist>
                    <p className="text-[10px] text-slate-400 mt-1">※ 既存メンバーの名前やゲームIDを入力・選択できます</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">同盟名</label>
                    <select
                      value={editingMember.alliance || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, alliance: e.target.value === '' ? null : e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-</option>
                      <option value="GEN">GEN</option>
                      <option value="GOD">GOD</option>
                      <option value="www">www</option>
                      <option value="RPN">RPN</option>
                      <option value="MSO">MSO</option>
                      <option value="NPT">NPT</option>
                      <option value="JvA">JvA</option>
                      <option value="ABU">ABU</option>
                      <option value="HUN">HUN</option>
                      <option value="ARK">ARK</option>
                      <option value="UTP">UTP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                    <select
                      value={editingMember.rank_role || 'R1'}
                      onChange={(e) => setEditingMember({ ...editingMember, rank_role: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="R4以上">R4以上</option>
                      <option value="R3">R3</option>
                      <option value="R2">R2</option>
                      <option value="R1">R1</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">ステータス</label>
                    <select
                      value={editingMember.status || 'active'}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        setEditingMember({
                          ...editingMember,
                          status: newStatus,
                        });
                      }}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="active">在籍中 (active)</option>
                      <option value="left">除名 (left)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">FC</label>
                    <select
                      value={editingMember.fc_level || 'FC6 以下'}
                      onChange={(e) => setEditingMember({ ...editingMember, fc_level: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="FC10">FC10</option>
                      <option value="FC9">FC9</option>
                      <option value="FC8">FC8</option>
                      <option value="FC7">FC7</option>
                      <option value="FC6 以下">FC6 以下</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">総力(現在) 例: 1.2B</label>
                    <input
                      type="text"
                      value={editingMember.current_power || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, current_power: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="hidden lg:block"></div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">盾兵</label>
                    <select
                      value={editingMember.shield_soldier || 'FC6T10以下'}
                      onChange={(e) => setEditingMember({ ...editingMember, shield_soldier: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="FC10T11">FC10T11</option>
                      <option value="FC9T11">FC9T11</option>
                      <option value="FC8T11">FC8T11</option>
                      <option value="FC7T11">FC7T11</option>
                      <option value="FC6T11">FC6T11</option>
                      <option value="FC5T11">FC5T11</option>
                      <option value="FC10T10">FC10T10</option>
                      <option value="FC9T10">FC9T10</option>
                      <option value="FC8T10">FC8T10</option>
                      <option value="FC7T10">FC7T10</option>
                      <option value="FC6T10以下">FC6T10以下</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">槍兵</label>
                    <select
                      value={editingMember.spear_soldier || 'FC6T10以下'}
                      onChange={(e) => setEditingMember({ ...editingMember, spear_soldier: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="FC10T11">FC10T11</option>
                      <option value="FC9T11">FC9T11</option>
                      <option value="FC8T11">FC8T11</option>
                      <option value="FC7T11">FC7T11</option>
                      <option value="FC6T11">FC6T11</option>
                      <option value="FC5T11">FC5T11</option>
                      <option value="FC10T10">FC10T10</option>
                      <option value="FC9T10">FC9T10</option>
                      <option value="FC8T10">FC8T10</option>
                      <option value="FC7T10">FC7T10</option>
                      <option value="FC6T10以下">FC6T10以下</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">弓兵</label>
                    <select
                      value={editingMember.bow_soldier || 'FC6T10以下'}
                      onChange={(e) => setEditingMember({ ...editingMember, bow_soldier: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="FC10T11">FC10T11</option>
                      <option value="FC9T11">FC9T11</option>
                      <option value="FC8T11">FC8T11</option>
                      <option value="FC7T11">FC7T11</option>
                      <option value="FC6T11">FC6T11</option>
                      <option value="FC5T11">FC5T11</option>
                      <option value="FC10T10">FC10T10</option>
                      <option value="FC9T10">FC9T10</option>
                      <option value="FC8T10">FC8T10</option>
                      <option value="FC7T10">FC7T10</option>
                      <option value="FC6T10以下">FC6T10以下</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">移民時期</label>
                    <select
                      value={editingMember.transfer || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, transfer: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-</option>
                      {transferOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">総力(移民前) 例: 650M</label>
                    <input
                      type="text"
                      value={editingMember.power_before_migration || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, power_before_migration: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="hidden lg:block"></div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">元鯖 (カンマ区切り)</label>
                    <input
                      type="text"
                      list="existing-states-list"
                      value={editingMember.state || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, state: e.target.value })}
                      placeholder="例: 2352, 2359"
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                    <datalist id="existing-states-list">
                      {existingStateOptions.map((st) => (
                        <option key={st} value={st} />
                      ))}
                    </datalist>

                    {existingStateOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-400 self-center mr-1">クイック追加:</span>
                        {existingStateOptions.map((st) => {
                          const currentStates = (editingMember.state || '')
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const isAlreadyAdded = currentStates.includes(st);

                          return (
                            <button
                              type="button"
                              key={st}
                              onClick={() => {
                                if (isAlreadyAdded) return;
                                const stateVal = editingMember.state ?? '';
                                const updated = currentStates.length > 0
                                  ? `${stateVal.trim()}, ${st}`
                                  : st;
                                setEditingMember({ ...editingMember, state: updated });
                              }}
                              className={`px-2 py-0.5 text-[11px] rounded transition border ${
                                isAlreadyAdded
                                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                              }`}
                            >
                              {st} {isAlreadyAdded && '✓'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer bg-[#0b0f19] p-3 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={parseBoolean(editingMember.leader)}
                      onChange={(e) => setEditingMember({ ...editingMember, leader: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-200">リーダー</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-[#0b0f19] p-3 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={parseBoolean(editingMember.is_in_2275)}
                      onChange={(e) => setEditingMember({ ...editingMember, is_in_2275: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-200">Discord(2275)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">備考</label>
                  <textarea
                    rows={3}
                    value={editingMember.note || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, note: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                    placeholder="自由記入欄..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition shadow"
                  >
                    保存する
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[#151c2c] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">移民時期の選択肢を追加</h3>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">移民時期ラベル名</label>
                  <input
                    type="text"
                    placeholder="[30]26/08/16"
                    value={newTransferLabel}
                    onChange={(e) => setNewTransferLabel(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">すでに登録されている移民時期一覧</label>
                  <div className="max-h-36 overflow-y-auto bg-[#0b0f19] border border-slate-800 rounded-lg p-2 space-y-1">
                    {transferOptions.length === 0 ? (
                      <p className="text-xs text-slate-500 p-1">登録されている時期はありません</p>
                    ) : (
                      transferOptions.map((opt) => (
                        <div key={opt} className="text-xs text-slate-200 px-2 py-1 bg-slate-800/50 rounded">
                          {opt}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddTransferOption}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium"
                >
                  追加する
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}