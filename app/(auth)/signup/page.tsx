'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { authConfirmUrl } from '@/lib/auth-redirect';
import { isDuplicateSignup, mapAuthError } from '@/lib/auth-errors';
import { ensureLabForUser } from '@/lib/ensure-lab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [labName, setLabName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          lab_name: labName,
        },
        emailRedirectTo: authConfirmUrl('/dashboard'),
      },
    });

    if (signUpError) {
      setError(mapAuthError(signUpError));
      setLoading(false);
      return;
    }

    if (isDuplicateSignup(data.user)) {
      setError('이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.');
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    if (data.session) {
      const { error: labError } = await ensureLabForUser(supabase, data.user, labName);
      if (labError) {
        setError(labError);
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <h2 className="text-xl font-medium mb-4">회원가입 완료!</h2>
          <p className="text-[#888] mb-6">
            <span className="text-white">{email}</span>로<br />
            인증 메일을 보냈습니다.<br />
            이메일을 확인해주세요.
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
          <p className="text-[#666] text-sm">현상소 회원가입</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-[#888] mb-2">현상소 이름</label>
            <input
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors"
              placeholder="필름현상소"
              required
            />
          </div>

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
            <label className="block text-sm text-[#888] mb-2">비밀번호</label>
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
            <label className="block text-sm text-[#888] mb-2">비밀번호 확인</label>
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

          {error && (
            <div className="text-[#c41e3a] text-sm space-y-1">
              <p>{error}</p>
              {error.includes('이미 가입') && (
                <p>
                  <Link href="/login" className="underline hover:text-white">로그인</Link>
                  {' · '}
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
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[#666]">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[#c41e3a] hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
