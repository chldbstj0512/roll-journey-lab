'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth-errors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EmailOtpType } from '@supabase/supabase-js';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const code = params.get('code');
      const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
      const type = (params.get('type') || hashParams.get('type')) as EmailOtpType | null;

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash) {
        await supabase.auth.verifyOtp({
          type: type ?? 'recovery',
          token_hash: tokenHash,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(Boolean(session));
      setChecking(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(mapAuthError(updateError));
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-[#888]">확인 중...</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <p className="text-[#888] mb-6">재설정 링크가 만료되었거나 유효하지 않습니다.</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg transition-colors"
          >
            로그인으로
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
          <p className="text-[#666] text-sm">새 비밀번호 설정</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#888] mb-2">새 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
              placeholder="6자 이상"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-2">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
              placeholder="비밀번호 재입력"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="text-[#c41e3a] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
