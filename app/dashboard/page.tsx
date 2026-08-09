'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Order } from '@/lib/types';
import { ORDER_STATUS_LABELS } from '@/lib/types';

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [labName, setLabName] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    fetchOrders();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setLabName(user.user_metadata?.lab_name || '현상소');
  };

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('lab_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusColor = (status: Order['status']) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-500',
      processing: 'bg-blue-500/20 text-blue-500',
      scanning: 'bg-purple-500/20 text-purple-500',
      completed: 'bg-green-500/20 text-green-500',
      delivered: 'bg-gray-500/20 text-gray-400',
    };
    return colors[status];
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing' || o.status === 'scanning').length,
    completed: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-light tracking-widest">ROLL & JOURNEY</h1>
            <p className="text-sm text-[#666]">{labName}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/orders/new"
              className="px-4 py-2 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg text-sm transition-colors"
            >
              + 새 주문
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-[#888] hover:text-white transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-sm text-[#666]">전체 주문</p>
            <p className="text-2xl font-light mt-1">{stats.total}</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-sm text-[#666]">대기 중</p>
            <p className="text-2xl font-light mt-1 text-yellow-500">{stats.pending}</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-sm text-[#666]">진행 중</p>
            <p className="text-2xl font-light mt-1 text-blue-500">{stats.processing}</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-sm text-[#666]">완료</p>
            <p className="text-2xl font-light mt-1 text-green-500">{stats.completed}</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2a2a2a]">
            <h2 className="font-medium">주문 목록</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[#666]">불러오는 중...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#666] mb-4">아직 주문이 없습니다</p>
              <Link
                href="/orders/new"
                className="inline-block px-4 py-2 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg text-sm transition-colors"
              >
                첫 주문 등록하기
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr className="text-sm text-[#888]">
                  <th className="text-left px-6 py-3 font-medium">고객</th>
                  <th className="text-left px-6 py-3 font-medium">필름</th>
                  <th className="text-left px-6 py-3 font-medium">롤 수</th>
                  <th className="text-left px-6 py-3 font-medium">상태</th>
                  <th className="text-left px-6 py-3 font-medium">접수일</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium">{order.customer_name}</p>
                      {order.customer_phone && (
                        <p className="text-sm text-[#666]">{order.customer_phone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[#888]">{order.film_type}</td>
                    <td className="px-6 py-4 text-[#888]">{order.roll_count}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#666]">
                      {new Date(order.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-[#c41e3a] hover:underline text-sm"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
