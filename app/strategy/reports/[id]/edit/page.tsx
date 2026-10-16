'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReportForm from '../../components/ReportForm';

export default function EditReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem('temp_reports');
      if (saved) {
        const reports = JSON.parse(saved);
        const target = reports.find((r: any) => r.id === id);
        if (target) {
          setReportData(target);
        }
      }
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return <div className="p-6 text-white bg-gray-950 min-h-screen">読み込み中...</div>;
  }

  if (!reportData) {
    return <div className="p-6 text-white bg-gray-950 min-h-screen">対象のレポートが見つかりませんでした。</div>;
  }

  return (
    <div className="p-6 text-white bg-gray-950 min-h-screen">
      <h1 className="text-xl font-bold mb-6">✏️ 戦闘レポートの修正</h1>
      <ReportForm initialData={reportData} isEdit={true} />
    </div>
  );
}