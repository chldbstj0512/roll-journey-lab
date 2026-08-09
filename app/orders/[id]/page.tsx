'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import type { Order, Photo } from '@/lib/types';
import { ORDER_STATUS_LABELS, OrderStatus } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchOrder();
    fetchPhotos();
  }, [orderId]);

  const fetchOrder = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      router.push('/dashboard');
      return;
    }
    setOrder(data);
    setLoading(false);
  };

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      setPhotos(data);
    }
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (!error) {
      setOrder(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    
    const totalFiles = acceptedFiles.length;
    let uploadedCount = 0;

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          uploadedCount++;
          setUploadProgress((uploadedCount / totalFiles) * 100);
        }
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    fetchPhotos();
  }, [orderId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.tif'],
    },
    multiple: true,
  });

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      scanning: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
      completed: 'bg-green-500/20 text-green-500 border-green-500/30',
      delivered: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[status];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#666]">불러오는 중...</p>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#888] hover:text-white">
              ← 돌아가기
            </Link>
            <h1 className="text-lg font-light">주문 #{orderId.slice(0, 8)}</h1>
          </div>
          <span className={`px-3 py-1 rounded border text-sm ${getStatusColor(order.status)}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Order Info */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">고객 정보</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#666]">이름</span>
                <span>{order.customer_name}</span>
              </div>
              {order.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-[#666]">연락처</span>
                  <span>{order.customer_phone}</span>
                </div>
              )}
              {order.customer_email && (
                <div className="flex justify-between">
                  <span className="text-[#666]">이메일</span>
                  <span>{order.customer_email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">필름 정보</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#666]">필름 종류</span>
                <span>{order.film_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">롤 수</span>
                <span>{order.roll_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">접수일</span>
                <span>{new Date(order.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Update */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">상태 변경</h2>
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'processing', 'scanning', 'completed', 'delivered'] as OrderStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  order.status === status
                    ? 'bg-[#c41e3a] text-white'
                    : 'bg-[#0a0a0a] border border-[#2a2a2a] text-[#888] hover:border-[#c41e3a] hover:text-white'
                }`}
              >
                {ORDER_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Upload */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">스캔 사진 업로드</h2>
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-[#c41e3a] bg-[#c41e3a]/10'
                : 'border-[#2a2a2a] hover:border-[#c41e3a]'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div>
                <p className="text-[#888] mb-2">업로드 중... {Math.round(uploadProgress)}%</p>
                <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                  <div
                    className="bg-[#c41e3a] h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : isDragActive ? (
              <p className="text-[#c41e3a]">여기에 파일을 놓으세요</p>
            ) : (
              <div>
                <p className="text-[#888]">
                  스캔한 사진을 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-sm text-[#555] mt-2">
                  JPG, PNG, TIFF 지원 (여러 파일 가능)
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Photos Grid */}
          {photos.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-[#666] mb-3">{photos.length}장 업로드됨</p>
              <div className="grid grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-[3/2] bg-[#0a0a0a] rounded-lg overflow-hidden"
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">메모</h2>
            <p className="text-[#888] text-sm whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
