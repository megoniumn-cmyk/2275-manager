'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Member = {
  game_id: string | number;
  name: string;
  alliance: string | null;
  status?: string | null;
};

type EventItem = {
  id: string;
  title: string;
  event_date: string | null;
  order_index: number;
};

type EventParticipation = {
  id: string;
  event_id: string;
  member_game_id: string | number;
  status: string;
};

type LeagueParticipation = {
  id?: string;
  event_id: string;
  member_game_id: string | number;
  match_number: number;
  status: string;
};

const OPTIONS_RALLY = ['-', '未エントリー', '軍1参加', '軍1欠席', '軍1控欠席', '軍1遅刻', '軍1指示×', '軍1指示△', '軍2参加', '軍2不参加・遅刻', '軍2指示×', '加入前'];
const OPTIONS_TEAM = ['-', '未エントリー', '未エントリー(移動なし)', '軍1参加', '軍1欠席', '軍1遅刻・離脱', '軍1指示×', '軍1指示△', '軍2参加', '軍2不参加・遅刻', '軍2指示×', '加入前'];
const OPTIONS_LEAGUE = ['-', '未エントリー', '未エントリー(移動なし)', '軍1全参加', '軍1ほぼ全参加', '軍1半分以上参加', '軍2エントリー', '加入前'];
const OPTIONS_SIEGE = ['-', '未エントリー', '攻撃参加(午前攻撃あり)', '攻撃参加(午前攻撃なし)', '攻撃参加(指示×)', '攻撃不参加(エントリーのみ)'];

// 兵器リーグ詳細設定用の個別選択肢（「未定」を削除）
const OPTIONS_LEAGUE_DETAIL = [
  '-',
  'フル参加',
  '不参加(連絡あり)',
  '途中参加・途中離脱(連絡あり)',
  '途中参加・途中離脱(連絡なし)',
  '欠勤(連絡なし)',
  '指示×'
];

const PRESET_EVENTS = ['SvS', '兵器工場戦', '峡谷合戦', '霜竜の覇者', '雪原兵器リーグ', '凛風攻城戦'];

function getOptionsForEvent(title: string) {
  if (['兵器工場戦', '峡谷合戦'].includes(title)) return OPTIONS_RALLY;
  if (['SvS', '霜竜の覇者'].includes(title)) return OPTIONS_TEAM;
  if (['雪原兵器リーグ'].includes(title)) return OPTIONS_LEAGUE;
  if (['凛風攻城戦'].includes(title)) return OPTIONS_SIEGE;
  return ['-', '未エントリー']; 
}

function getLeagueDates(startDate: string | null) {
  if (!startDate) return Array.from({ length: 7 }, (_, i) => `第${i + 1}戦`);
  const dates = [];
  const baseDate = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 2);
    dates.push(`${d.getMonth() + 1}/${d.getDate()} (第${i + 1}戦)`);
  }
  return dates;
}

function getAllianceColorClass(alliance: string | null) {
  switch (alliance) {
    case 'GOD':
      return 'text-red-400 font-bold';
    case 'GEN':
      return 'text-blue-400 font-bold';
    case 'www':
      return 'text-purple-400 font-bold';
    default:
      return 'text-white';
  }
}

export default function EventsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [participations, setParticipations] = useState<EventParticipation[]>([]);
  const [leagueParticipations, setLeagueParticipations] = useState<LeagueParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'left'>('active');

  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const [rowCheckFilter, setRowCheckFilter] = useState<'all' | 'checked' | 'unchecked'>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState('SvS');
  const [eventDate, setEventDate] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDate, setEditEventDate] = useState('');

  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState(false);
  const [leagueModalData, setLeagueModalData] = useState<{ event: EventItem; member: Member } | null>(null);
  const [leagueModalEdits, setLeagueModalEdits] = useState<Record<number, string>>({});

  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [nameFilters, setNameFilters] = useState<string[]>([]);
  const [allianceFilters, setAllianceFilters] = useState<string[]>([]);
  const [eventFilters, setEventFilters] = useState<Record<string, string[]>>({});

  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [nameSearchText, setNameSearchText] = useState<string>('');

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveFilterDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchData() {
    setLoading(true);
    const [membersRes, eventsRes, partsRes, leaguePartsRes] = await Promise.all([
      supabase.from('members').select('game_id, name, alliance, status').not('game_id', 'is', null).limit(5000),
      supabase.from('events').select('*').order('order_index', { ascending: true }).order('event_date', { ascending: true }).limit(1000),
      supabase.from('event_participations').select('*').limit(10000),
      supabase.from('league_participations').select('*').limit(10000),
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (partsRes.data) setParticipations(partsRes.data);
    if (leaguePartsRes.data) setLeagueParticipations(leaguePartsRes.data);
    
    setLoading(false);
  }

  const allianceList = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.alliance) set.add(m.alliance);
    });
    return Array.from(set);
  }, [members]);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const nextOrder = events.length > 0 ? Math.max(...events.map((ev) => ev.order_index || 0)) + 1 : 0;

    const { error } = await supabase.from('events').insert([
      { title: selectedEventTitle, event_date: eventDate || null, order_index: nextOrder }
    ]);

    if (error) {
      console.error('Error adding event:', error);
      alert(`イベントの追加に失敗しました: ${error.message}`);
    } else {
      setIsAddModalOpen(false);
      setEventDate('');
      fetchData();
    }
  }

  function openEditModal(eventItem: EventItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingEvent(eventItem);
    setEditEventTitle(eventItem.title);
    setEditEventDate(eventItem.event_date || '');
    setIsEditModalOpen(true);
  }

  async function handleUpdateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;

    const { error } = await supabase
      .from('events')
      .update({
        title: editEventTitle,
        event_date: editEventDate || null,
      })
      .eq('id', editingEvent.id);

    if (error) {
      console.error('Error updating event:', error);
      alert(`イベントの更新に失敗しました: ${error.message}`);
    } else {
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchData();
    }
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    if (!confirm(`「${editingEvent.title} (${editingEvent.event_date || '日時未設定'})」を削除してもよろしいですか？紐づく参加ステータスも削除されます。`)) {
      return;
    }

    await supabase.from('event_participations').delete().eq('event_id', editingEvent.id);
    await supabase.from('league_participations').delete().eq('event_id', editingEvent.id);
    const { error } = await supabase.from('events').delete().eq('id', editingEvent.id);

    if (error) {
      console.error('Error deleting event:', error);
      alert(`イベントの削除に失敗しました: ${error.message}`);
    } else {
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchData();
    }
  }

  async function handleStatusChange(eventId: string, memberGameId: string | number, status: string) {
    if (status === '-' || !status) {
      const { error } = await supabase
        .from('event_participations')
        .delete()
        .eq('event_id', eventId)
        .eq('member_game_id', memberGameId);

      if (error) {
        console.error('Error deleting participation:', error);
      } else {
        setParticipations((prev) =>
          prev.filter((p) => !(p.event_id === eventId && String(p.member_game_id) === String(memberGameId)))
        );
      }
      return;
    }

    const { data, error } = await supabase
      .from('event_participations')
      .upsert(
        [{ event_id: eventId, member_game_id: memberGameId, status }],
        { onConflict: 'event_id, member_game_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting participation:', error);
      alert(`ステータスの保存に失敗しました: ${error.message}`);
    } else if (data) {
      setParticipations((prev) => {
        const index = prev.findIndex((p) => p.event_id === eventId && String(p.member_game_id) === String(memberGameId));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        } else {
          return [...prev, data];
        }
      });
    }
  }

  function openLeagueModal(event: EventItem, member: Member) {
    const parts = leagueParticipations.filter(p => p.event_id === event.id && String(p.member_game_id) === String(member.game_id));
    const edits: Record<number, string> = {};
    for (let i = 1; i <= 7; i++) {
      const part = parts.find(p => p.match_number === i);
      edits[i] = part ? part.status : '-';
    }
    setLeagueModalData({ event, member });
    setLeagueModalEdits(edits);
    setIsLeagueModalOpen(true);
  }

  async function handleSaveLeagueModal() {
    if (!leagueModalData) return;
    const { event, member } = leagueModalData;

    const upsertData = [];
    for (let i = 1; i <= 7; i++) {
      upsertData.push({
        event_id: event.id,
        member_game_id: member.game_id,
        match_number: i,
        status: leagueModalEdits[i],
      });
    }

    const { error } = await supabase
      .from('league_participations')
      .upsert(upsertData, { onConflict: 'event_id, member_game_id, match_number' });

    if (error) {
      console.error(error);
      alert(`兵器リーグの詳細データの保存に失敗しました: ${error.message}`);
    } else {
      setIsLeagueModalOpen(false);
      fetchData();
    }
  }

  async function moveEvent(index: number, direction: 'left' | 'right', e: React.MouseEvent) {
    e.stopPropagation();
    const newEvents = [...events];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newEvents.length) return;

    const temp = newEvents[index];
    newEvents[index] = newEvents[targetIndex];
    newEvents[targetIndex] = temp;

    setEvents(newEvents);

    for (let i = 0; i < newEvents.length; i++) {
      await supabase.from('events').update({ order_index: i }).eq('id', newEvents[i].id);
    }
  }

  function toggleNameFilter(gameId: string) {
    setNameFilters((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  }

  function toggleAllianceFilter(al: string) {
    setAllianceFilters((prev) =>
      prev.includes(al) ? prev.filter((item) => item !== al) : [...prev, al]
    );
  }

  function toggleEventStatusFilter(eventId: string, statusVal: string) {
    setEventFilters((prev) => {
      const currentList = prev[eventId] || [];
      const updatedList = currentList.includes(statusVal)
        ? currentList.filter((s) => s !== statusVal)
        : [...currentList, statusVal];
      return {
        ...prev,
        [eventId]: updatedList,
      };
    });
  }

  const filteredMemberListForPopup = useMemo(() => {
    const targetMembers = members.filter((m) => (viewMode === 'active' ? m.status !== 'left' : m.status === 'left'));
    if (!nameSearchText.trim()) return targetMembers;
    const query = nameSearchText.toLowerCase();
    return targetMembers.filter((m) => (m.name || '').toLowerCase().includes(query));
  }, [members, nameSearchText, viewMode]);

  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const memberStatus = member.status || 'active';
      if (viewMode === 'active' && memberStatus === 'left') return false;
      if (viewMode === 'left' && memberStatus !== 'left') return false;

      const isChecked = !!checkedRows[String(member.game_id)];
      if (rowCheckFilter === 'checked' && !isChecked) return false;
      if (rowCheckFilter === 'unchecked' && isChecked) return false;

      if (globalSearch.trim() !== '') {
        const query = globalSearch.toLowerCase();
        if (
          !(member.name || '').toLowerCase().includes(query) &&
          !(String(member.game_id) || '').toLowerCase().includes(query) &&
          !(member.alliance || '').toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (nameFilters.length > 0) {
        if (!nameFilters.includes(String(member.game_id))) {
          return false;
        }
      }

      if (allianceFilters.length > 0) {
        const memAlliance = member.alliance || '';
        if (!allianceFilters.includes(memAlliance)) {
          return false;
        }
      }

      for (const event of events) {
        const selectedStatuses = eventFilters[event.id] || [];
        if (selectedStatuses.length > 0) {
          const part = participations.find(
            (p) => p.event_id === event.id && String(p.member_game_id).trim() === String(member.game_id).trim()
          );
          const currentStatus = part ? part.status : '-';
          if (!selectedStatuses.includes(currentStatus)) {
            return false;
          }
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortField === 'alliance') {
        valA = (a.alliance || '').toLowerCase();
        valB = (b.alliance || '').toLowerCase();
      } else {
        const partA = participations.find((p) => p.event_id === sortField && String(p.member_game_id).trim() === String(a.game_id).trim());
        const partB = participations.find((p) => p.event_id === sortField && String(p.member_game_id).trim() === String(b.game_id).trim());
        valA = partA ? partA.status : '-';
        valB = partB ? partB.status : '-';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, participations, sortField, sortDirection, nameFilters, allianceFilters, eventFilters, events, globalSearch, viewMode, checkedRows, rowCheckFilter]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function clearAllFilters() {
    setNameFilters([]);
    setAllianceFilters([]);
    setEventFilters({});
    setNameSearchText('');
    setGlobalSearch('');
    setRowCheckFilter('all');
    setActiveFilterDropdown(null);
  }

  function handleExportCSV() {
    if (events.length === 0 || members.length === 0) {
      alert('エクスポートするデータがありません。');
      return;
    }

    const headers = ['game_id', 'name', 'alliance', ...events.map((e) => `${e.title}_${e.event_date || '未設定'}`)];
    const csvRows = [headers.join(',')];

    for (const member of members) {
      const row = [
        `"${member.game_id}"`,
        `"${member.name}"`,
        `"${member.alliance || ''}"`,
      ];

      for (const event of events) {
        const part = participations.find(
          (p) => p.event_id === event.id && String(p.member_game_id).trim() === String(member.game_id).trim()
        );
        const status = part ? part.status : '-';
        row.push(`"${status}"`);
      }
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `event_participations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((line) => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSVの形式が正しくありません。');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
      const eventHeaders = headers.slice(3);

      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        if (row.length < 3) continue;

        const gameId = row[0].replace(/^"|"$/g, '').trim();
        for (let j = 0; j < eventHeaders.length; j++) {
          const colIndex = 3 + j;
          if (row[colIndex] !== undefined) {
            const newStatus = row[colIndex].replace(/^"|"$/g, '').trim();
            if (events[j]) {
              const targetEventId = events[j].id;

              // 既存の参加ステータスをチェック
              const existingPart = participations.find(
                (p) => p.event_id === targetEventId && String(p.member_game_id).trim() === String(gameId).trim()
              );
              const currentStatus = existingPart ? existingPart.status : '-';

              // データベース上のステータスとCSVの値が異なる場合のみ更新（差分のみ）
              if (currentStatus !== newStatus) {
                await handleStatusChange(targetEventId, gameId, newStatus);
                processedCount++;
              } else {
                skippedCount++;
              }
            }
          }
        }
      }

      alert(`CSVインポートが完了しました\n（更新: ${processedCount}件 / 変更なしスキップ: ${skippedCount}件）`);
      fetchData();
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    );
  }

  const hasActiveFilters =
    nameFilters.length > 0 ||
    allianceFilters.length > 0 ||
    globalSearch !== '' ||
    rowCheckFilter !== 'all' ||
    Object.values(eventFilters).some((list) => list && list.length > 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold">イベント参加状況管理</h1>
            
            <input
              type="text"
              placeholder="名前、同盟で検索..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 w-64"
            />

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 text-xs rounded transition"
              >
                すべてのフィルターをクリア
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setViewMode(viewMode === 'active' ? 'left' : 'active');
                clearAllFilters();
              }}
              className={`px-4 py-2 border font-medium rounded transition text-sm flex items-center gap-1.5 ${
                viewMode === 'left'
                  ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
              }`}
            >
              <span>📁</span>
              <span>{viewMode === 'left' ? '在籍メンバーに戻る' : '過去メンバー（非在籍）'}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium rounded transition text-sm"
            >
              CSV出力
            </button>
            <button
              onClick={() => csvFileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium rounded transition text-sm"
            >
              CSV取込
            </button>
            <input
              type="file"
              ref={csvFileInputRef}
              onChange={handleImportCSV}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-medium rounded transition text-sm"
            >
              + イベント追加
            </button>
          </div>
        </div>

        {viewMode === 'left' && (
          <div className="mb-4 px-4 py-2 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 text-xs flex items-center justify-between">
            <span>現在は「過去メンバー（非在籍：status=left）」を表示しています。</span>
            <button
              onClick={() => { setViewMode('active'); clearAllFilters(); }}
              className="underline hover:text-white"
            >
              在籍メンバー表示に戻る
            </button>
          </div>
        )}

        <div className="bg-gray-900 rounded-lg border border-gray-800 shadow-xl overflow-auto max-h-[75vh]">
          <table className="w-full border-collapse text-left whitespace-nowrap text-xs">
            <thead>
              <tr className="bg-gray-800 text-gray-300">
                <th
                  style={{ left: '0px', width: '50px', minWidth: '50px', maxWidth: '50px' }}
                  className="px-3 py-3 sticky top-0 bg-gray-800 z-40 border-b border-gray-700 text-center"
                >
                  <input
                    type="checkbox"
                    title="表示中の全選択/解除"
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const newChecked = { ...checkedRows };
                      filteredAndSortedMembers.forEach((m) => {
                        newChecked[String(m.game_id)] = checked;
                      });
                      setCheckedRows(newChecked);
                    }}
                    checked={
                      filteredAndSortedMembers.length > 0 &&
                      filteredAndSortedMembers.every((m) => checkedRows[String(m.game_id)])
                    }
                    className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  style={{ left: '50px', width: '130px', minWidth: '130px', maxWidth: '130px' }}
                  className="px-4 py-3 sticky top-0 bg-gray-800 z-40 cursor-pointer hover:text-white select-none border-b border-gray-700 truncate"
                >
                  名前 {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => handleSort('alliance')}
                  style={{ left: '180px', width: '90px', minWidth: '90px', maxWidth: '90px' }}
                  className="px-4 py-3 sticky top-0 bg-gray-800 z-40 cursor-pointer hover:text-white select-none border-b border-gray-700 truncate"
                >
                  同盟 {sortField === 'alliance' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>

                {events.map((event, index) => (
                  <th
                    key={event.id}
                    onClick={() => handleSort(event.id)}
                    className="px-4 py-3 border-l border-b border-gray-700 min-w-[200px] cursor-pointer hover:bg-gray-750 select-none sticky top-0 z-20 bg-gray-800"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-400">
                          {event.title} {sortField === event.id && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={(e) => openEditModal(event, e)}
                            className="px-1.5 py-0.5 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded text-[11px] transition"
                            title="イベントを編集"
                          >
                            編集
                          </button>
                          <div className="flex gap-1 text-[11px]">
                            <button
                              onClick={(e) => moveEvent(index, 'left', e)}
                              disabled={index === 0}
                              className="px-1.5 py-0.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                              title="左へ移動"
                            >
                              ◀
                            </button>
                            <button
                              onClick={(e) => moveEvent(index, 'right', e)}
                              disabled={index === events.length - 1}
                              className="px-1.5 py-0.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
                              title="右へ移動"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400">{event.event_date || '日時未設定'}</span>
                    </div>
                  </th>
                ))}
              </tr>

              <tr className="bg-[#161a23]">
                <th style={{ left: '0px', width: '50px', minWidth: '50px', maxWidth: '50px' }} className="px-2 py-2 sticky top-[51px] bg-[#161a23] z-40 border-b border-gray-700 text-center" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={rowCheckFilter}
                    onChange={(e) => setRowCheckFilter(e.target.value as 'all' | 'checked' | 'unchecked')}
                    className="w-full px-1 py-1 bg-gray-900 border border-gray-700 rounded text-[10px] text-white focus:outline-none focus:border-blue-500"
                    title="チェック有無でフィルタ"
                  >
                    <option value="all">全</option>
                    <option value="checked">有</option>
                    <option value="unchecked">無</option>
                  </select>
                </th>
                <th style={{ left: '50px', width: '130px', minWidth: '130px', maxWidth: '130px' }} className="px-2 py-2 sticky top-[51px] bg-[#161a23] z-40 border-b border-gray-700" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'name' ? null : 'name')}
                    className={`w-full px-2 py-1 rounded text-[11px] text-left border flex justify-between items-center ${
                      nameFilters.length > 0
                        ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                        : 'bg-gray-900 border-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="truncate">
                      {nameFilters.length === 0
                        ? '名前選択'
                        : `名前 (${nameFilters.length})`}
                    </span>
                    <span className="text-[9px]">▼</span>
                  </button>

                  {activeFilterDropdown === 'name' && (
                    <div ref={dropdownRef} className="absolute left-2 top-9 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                      <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                        <span>名前フィルタ</span>
                        {nameFilters.length > 0 && (
                          <button
                            onClick={() => setNameFilters([])}
                            className="text-blue-400 hover:underline"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="名前を検索..."
                          value={nameSearchText}
                          onChange={(e) => setNameSearchText(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredMemberListForPopup.map((member) => {
                          const isChecked = nameFilters.includes(String(member.game_id));
                          return (
                            <label
                              key={String(member.game_id)}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleNameFilter(String(member.game_id))}
                                className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                              />
                              <span className="truncate">{member.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                <th style={{ left: '180px', width: '90px', minWidth: '90px', maxWidth: '90px' }} className="px-2 py-2 sticky top-[51px] bg-[#161a23] z-40 border-b border-gray-700" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'alliance' ? null : 'alliance')}
                    className={`w-full px-2 py-1 rounded text-[11px] text-left border flex justify-between items-center ${
                      allianceFilters.length > 0
                        ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                        : 'bg-gray-900 border-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="truncate">
                      {allianceFilters.length === 0
                        ? '同盟選択'
                        : `同盟 (${allianceFilters.length})`}
                    </span>
                    <span className="text-[9px]">▼</span>
                  </button>

                  {activeFilterDropdown === 'alliance' && (
                    <div ref={dropdownRef} className="absolute left-2 top-9 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                      <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                        <span>同盟フィルタ</span>
                        {allianceFilters.length > 0 && (
                          <button
                            onClick={() => setAllianceFilters([])}
                            className="text-blue-400 hover:underline"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {allianceList.map((al) => {
                          const isChecked = allianceFilters.includes(al);
                          return (
                            <label
                              key={al}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAllianceFilter(al)}
                                className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                              />
                              <span className={`truncate ${getAllianceColorClass(al)}`}>{al || '(未設定)'}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                {events.map((event) => {
                  const selectedStatuses = eventFilters[event.id] || [];
                  const isDropdownOpen = activeFilterDropdown === event.id;
                  const currentOptions = getOptionsForEvent(event.title);

                  return (
                    <th key={event.id} className="px-3 py-2 border-l border-b border-gray-700 relative z-10 bg-[#161a23] sticky top-[51px]" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveFilterDropdown(isDropdownOpen ? null : event.id)}
                        className={`w-full px-2 py-1 rounded text-[11px] text-left border flex justify-between items-center ${
                          selectedStatuses.length > 0
                            ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                            : 'bg-gray-900 border-gray-700 text-gray-300'
                        }`}
                      >
                        <span className="truncate">
                          {selectedStatuses.length === 0
                            ? 'ステータス選択'
                            : `選択中 (${selectedStatuses.length})`}
                        </span>
                        <span className="text-[9px]">▼</span>
                      </button>

                      {isDropdownOpen && (
                        <div ref={dropdownRef} className="absolute left-2 top-9 w-52 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 text-left">
                          <div className="flex justify-between items-center mb-2 px-1 text-[11px] text-gray-400 border-b border-gray-800 pb-1">
                            <span>ステータスフィルタ</span>
                            {selectedStatuses.length > 0 && (
                              <button
                                onClick={() => {
                                  setEventFilters((prev) => ({ ...prev, [event.id]: [] }));
                                }}
                                className="text-blue-400 hover:underline"
                              >
                                クリア
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {currentOptions.map((opt) => {
                              const isChecked = selectedStatuses.includes(opt);
                              return (
                                <label
                                  key={opt}
                                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-gray-300 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleEventStatusFilter(event.id, opt)}
                                    className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                                  />
                                  <span className="truncate">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMembers.map((member) => {
                const gameIdStr = String(member.game_id);
                const isRowChecked = !!checkedRows[gameIdStr];

                return (
                  <tr key={gameIdStr} className="hover:bg-gray-850 border-b border-gray-800/60">
                    <td
                      style={{ left: '0px', width: '50px', minWidth: '50px', maxWidth: '50px' }}
                      className="px-3 py-2 sticky bg-gray-900 z-10 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={isRowChecked}
                        onChange={(e) => {
                          setCheckedRows({ ...checkedRows, [gameIdStr]: e.target.checked });
                        }}
                        className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td
                      style={{ left: '50px', width: '130px', minWidth: '130px', maxWidth: '130px' }}
                      className="px-4 py-2 sticky bg-gray-900 z-10 font-medium text-white truncate"
                      title={member.name}
                    >
                      {member.name}
                    </td>
                    <td
                      style={{ left: '180px', width: '90px', minWidth: '90px', maxWidth: '90px' }}
                      className={`px-4 py-2 sticky bg-gray-900 z-10 truncate ${getAllianceColorClass(member.alliance)}`}
                      title={member.alliance || ''}
                    >
                      {member.alliance || '-'}
                    </td>

                    {events.map((event) => {
                      const part = participations.find(
                        (p) => p.event_id === event.id && String(p.member_game_id).trim() === gameIdStr
                      );
                      const currentStatus = part ? part.status : '-';
                      const currentOptions = getOptionsForEvent(event.title);

                      if (event.title === '雪原兵器リーグ') {
                        const leagueParts = leagueParticipations.filter(
                          (p) => p.event_id === event.id && String(p.member_game_id).trim() === gameIdStr
                        );
                        const summaryText = leagueParts.length > 0
                          ? `${leagueParts.filter(p => p.status !== '-' && p.status !== '未エントリー').length}/7戦参加`
                          : '-';

                        return (
                          <td key={event.id} className="px-4 py-2 border-l border-gray-800 text-gray-300">
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={currentStatus}
                                onChange={(e) => handleStatusChange(event.id, member.game_id, e.target.value)}
                                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                              >
                                {currentOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => openLeagueModal(event, member)}
                                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded text-[11px] border border-gray-700 transition text-center"
                              >
                                {summaryText} (詳細設定)
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={event.id} className="px-4 py-2 border-l border-gray-800 text-gray-300">
                          <select
                            value={currentStatus}
                            onChange={(e) => handleStatusChange(event.id, member.game_id, e.target.value)}
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                          >
                            {currentOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* イベント追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-white">イベント追加</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">イベント種別</label>
                <select
                  value={selectedEventTitle}
                  onChange={(e) => setSelectedEventTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {PRESET_EVENTS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">開催日</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white font-medium transition"
                >
                  追加する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* イベント編集・削除モーダル */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-white">イベントの編集・削除</h2>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">イベント名</label>
                <input
                  type="text"
                  value={editEventTitle}
                  onChange={(e) => setEditEventTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">開催日</label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-700/50 rounded text-sm transition"
                >
                  このイベントを削除
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white font-medium transition"
                  >
                    更新する
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 兵器リーグ詳細モーダル */}
      {isLeagueModalOpen && leagueModalData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1 text-white">雪原兵器リーグ 詳細設定</h2>
            <p className="text-xs text-gray-400 mb-4">対象: {leagueModalData.member.name} ({leagueModalData.event.title})</p>
            
            <div className="space-y-3 mb-6">
              {getLeagueDates(leagueModalData.event.event_date).map((dateStr, idx) => {
                const matchNum = idx + 1;
                return (
                  <div key={matchNum} className="flex items-center justify-between bg-gray-800/50 p-2.5 rounded border border-gray-800">
                    <span className="text-xs font-medium text-gray-300">{dateStr}</span>
                    <select
                      value={leagueModalEdits[matchNum] || '-'}
                      onChange={(e) => setLeagueModalEdits({ ...leagueModalEdits, [matchNum]: e.target.value })}
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {OPTIONS_LEAGUE_DETAIL.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLeagueModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveLeagueModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white font-medium transition"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}