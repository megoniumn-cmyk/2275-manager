// components/MemberTable.tsx
'use client';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function MemberTable({ showPrivateFields = false }) {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('members').select('*');
      setMembers(data || []);
    }
    fetchData();
  }, []);

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th>ID</th>
          <th>名前</th>
          <th>FC</th>
          {showPrivateFields && <th>熊罠</th>}
          {showPrivateFields && <th>情報共有</th>}
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.game_id}>
            <td>{m.game_id}</td>
            <td>{m.name}</td>
            <td>{m.fc_level}</td>
            {showPrivateFields && <td>{m.bear}</td>}
            {showPrivateFields && <td>{m.info_sharing ? '有' : '無'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}