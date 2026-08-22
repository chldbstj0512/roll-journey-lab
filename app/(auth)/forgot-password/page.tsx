'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { authConfirmUrl } from '@/lib/auth-redirect';
import { mapAuthError } from '@/lib/auth-errors';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('error');
    if (fromLink) {
      setError(fromLink);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authConfirmUrl('/reset-password'),
    });

    if (resetError) {
      setError(mapAuthError(resetError));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <h2 className="text-xl font-medium mb-4">메일을 보냈습니다</h2>
          <p className="text-[#888] mb-6">
            <span className="text-white">{email}</span>로<br />
            비밀번호 재설정 링크를 보냈습니다.<br />
            메일에서 링크를 누르면 새 비밀번호를 설정할 수 있습니다.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg transition-colors"
          >
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <p className="text-[#666] text-sm">비밀번호 찾기</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#888] mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
              placeholder="lab@example.com"
              autoComplete="email"
              required
            />
          </div>

          {error && (
            <div className="text-[#c41e3a] text-sm space-y-1">
              <p>{error}</p>
              {error.includes('등록되지 않은') && (
                <p>
                  <Link href="/signup" className="underline hover:text-white">회원가입</Link>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '보내는 중...' : '재설정 메일 보내기'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[#666]">
          <Link href="/login" className="text-[#c41e3a] hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
