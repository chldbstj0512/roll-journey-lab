'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FILM_TYPES = [
  '35mm 컬러',
  '35mm 흑백',
  '120 컬러',
  '120 흑백',
  '110',
  '기타',
];

export default function NewOrderPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [filmType, setFilmType] = useState(FILM_TYPES[0]);
  const [rollCount, setRollCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error: insertError } = await supabase
      .from('orders')
      .insert({
        lab_id: user.id,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        film_type: filmType,
        roll_count: rollCount,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/orders/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-[#888] hover:text-white">
            ← 돌아가기
          </Link>
          <h1 className="text-lg font-light">새 주문 등록</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">고객 정보</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#888] mb-2">이름 *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#888] mb-2">연락처</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#888] mb-2">이메일</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">필름 정보</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#888] mb-2">필름 종류 *</label>
                <select
                  value={filmType}
                  onChange={(e) => setFilmType(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
                >
                  {FILM_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#888] mb-2">롤 수 *</label>
                <input
                  type="number"
                  min={1}
                  value={rollCount}
                  onChange={(e) => setRollCount(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-[#888] mb-2">메모</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors resize-none"
                  placeholder="요청사항, 특이사항 등"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[#c41e3a] text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '등록 중...' : '주문 등록'}
          </button>
        </form>
      </main>
    </div>
  );
}
