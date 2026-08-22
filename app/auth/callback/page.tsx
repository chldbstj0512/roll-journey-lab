'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { ensureLabForUser } from '@/lib/ensure-lab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EmailOtpType } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('인증 확인 중...');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const code = params.get('code');
      const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
      const next = params.get('next') || hashParams.get('next');
      const type = (params.get('type') || hashParams.get('type')) as EmailOtpType | null;

      if (code || params.get('token_hash')) {
        const confirm = new URL('/auth/confirm', window.location.origin);
        params.forEach((value, key) => confirm.searchParams.set(key, value));
        window.location.replace(confirm.toString());
        return;
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: type ?? 'recovery',
          token_hash: tokenHash,
        });
        if (error) {
          setStatus('error');
          setMessage('인증에 실패했습니다. 링크가 만료되었을 수 있습니다.');
          return;
        }
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setMessage('인증에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      if (session?.user) {
        const isRecovery = type === 'recovery' || next === '/reset-password';
        if (isRecovery) {
          router.replace('/reset-password');
          return;
        }

        await ensureLabForUser(supabase, session.user);
        setStatus('success');
        setMessage('이메일 인증이 완료되었습니다!');
        setTimeout(() => {
          router.push(next && next.startsWith('/') ? next : '/dashboard');
        }, 2000);
        return;
      }

      setStatus('error');
      setMessage('세션을 찾을 수 없습니다. 로그인 화면에서 인증번호로 재설정해주세요.');
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#2a2a2a] flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-[#888] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-[#888]">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
            <h2 className="text-xl font-medium mb-4 text-green-500">{message}</h2>
            <p className="text-[#888] mb-6">잠시 후 대시보드로 이동합니다...</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg transition-colors"
            >
              대시보드로 이동
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
            <h2 className="text-xl font-medium mb-4 text-red-500">인증 실패</h2>
            <p className="text-[#888] mb-6">{message}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg transition-colors"
            >
              로그인 페이지로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
