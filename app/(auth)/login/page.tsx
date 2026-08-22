'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { mapAuthError } from '@/lib/auth-errors';
import { ensureLabForUser } from '@/lib/ensure-lab';
import { authConfirmUrl } from '@/lib/auth-redirect';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EmailOtpForm } from '@/components/email-otp-form';
import type { EmailOtpType } from '@supabase/supabase-js';

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
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [otpType, setOtpType] = useState<EmailOtpType>('recovery');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('error');
    if (fromLink) setError(fromLink);
  }, []);

  const sendRecoveryOtp = async (to: string) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(to, {
      redirectTo: authConfirmUrl('/reset-password'),
    });
    if (resetError) {
      setError(mapAuthError(resetError));
      return false;
    }
    setOtpType('recovery');
    setStep('otp');
    setError('');
    return true;
  };

  const sendSignupOtp = async (to: string) => {
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: to,
    });
    if (resendError) {
      setError(mapAuthError(resendError));
      return false;
    }
    setOtpType('signup');
    setStep('otp');
    setError('');
    return true;
  };

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

      const emailNotConfirmed =
        code === 'email_not_confirmed' || message.includes('email not confirmed');

      if (emailNotConfirmed) {
        await sendSignupOtp(email);
        setLoading(false);
        return;
      }

      if (invalidCredentials) {
        const exists = await lookupEmail(email);
        if (exists === false) {
          setError('등록되지 않은 이메일입니다.');
          setLoading(false);
          return;
        }
        await sendRecoveryOtp(email);
        setLoading(false);
        return;
      }

      setError(mapAuthError(signInError));
      setLoading(false);
      return;
    }

    if (data.user) {
      await ensureLabForUser(supabase, data.user);
    }

    router.push('/dashboard');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: otpType,
    });

    if (verifyError) {
      setError(mapAuthError(verifyError, '인증번호가 올바르지 않습니다.'));
      setLoading(false);
      return;
    }

    if (otpType === 'recovery') {
      router.replace('/reset-password');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await ensureLabForUser(supabase, user);
    }
    router.replace('/dashboard');
  };

  const handleKakao = () => {
    window.location.assign('/auth/kakao/start');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light tracking-widest mb-2">ROLL & JOURNEY</h1>
          <p className="text-[#666] text-sm">현상소 관리 시스템</p>
        </div>

        {step === 'login' ? (
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
              <label className="block text-sm text-[#888] mb-2">비밀번호</label>
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
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              onClick={handleKakao}
              disabled={loading}
              className="w-full py-3 bg-[#FEE500] hover:bg-[#f5dc00] text-[#191919] rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              카카오 로그인
            </button>
          </form>
        ) : (
          <EmailOtpForm
            email={email}
            otp={otp}
            loading={loading}
            error={error}
            onOtpChange={setOtp}
            onSubmit={handleVerifyOtp}
            onResend={() => {
              if (otpType === 'signup') {
                void sendSignupOtp(email);
                return;
              }
              void sendRecoveryOtp(email);
            }}
          />
        )}

        {step === 'login' && (
          <p className="text-center mt-6 text-sm text-[#666]">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="text-[#c41e3a] hover:underline">
              회원가입
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
