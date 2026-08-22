'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth-errors';
import { ensureLabForUser } from '@/lib/ensure-lab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

async function lookupEmail(email: string): Promise<boolean | null> {
  try {
    const response = await fetch('/api/auth/account-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload.exists === 'boolean' ? payload.exists : null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const code = (signInError.code ?? '').toLowerCase();
      const message = (signInError.message ?? '').toLowerCase();
      const invalidCredentials =
        code === 'invalid_credentials' || message.includes('invalid login credentials');

      if (invalidCredentials) {
        const exists = await lookupEmail(email);
        if (exists === false) {
          setError('등록되지 않은 이메일입니다.');
        } else if (exists === true) {
          setError('비밀번호가 올바르지 않습니다.');
        } else {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
      } else {
        setError(mapAuthError(signInError));
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      await ensureLabForUser(supabase, data.user);
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <p className="text-[#666] text-sm">현상소 관리 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#888]">비밀번호</label>
              <Link href="/forgot-password" className="text-sm text-[#c41e3a] hover:underline">
                비밀번호 찾기
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
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
              {error.includes('비밀번호가 올바르지') && (
                <p>
                  <Link href="/forgot-password" className="underline hover:text-white">비밀번호 찾기</Link>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[#666]">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[#c41e3a] hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
