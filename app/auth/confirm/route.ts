import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { ensureLabForUser } from '@/lib/ensure-lab';

function safeNext(path: string | null, fallback: string) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    return path;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = (searchParams.get('type') as EmailOtpType | null) ?? null;
  const authError = searchParams.get('error_description') || searchParams.get('error');
  const nextParam = searchParams.get('next');
  const isRecovery = type === 'recovery' || nextParam === '/reset-password';
  const next = safeNext(nextParam, isRecovery ? '/reset-password' : '/dashboard');

  const redirectWithError = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (authError) {
    return redirectWithError(
      isRecovery
        ? '재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해주세요.'
        : '카카오 로그인에 실패했습니다. 다시 시도해주세요.',
    );
  }

  if (!tokenHash && !code) {
    return redirectWithError('인증 정보가 없습니다. 메일의 링크를 다시 눌러주세요.');
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let verifyError: { message?: string } | null = null;

  if (tokenHash) {
    const otpType: EmailOtpType = type ?? (isRecovery ? 'recovery' : 'email');
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    verifyError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verifyError = error;
  }

  if (verifyError) {
    return redirectWithError(
      isRecovery
        ? '재설정 링크가 만료되었거나 유효하지 않습니다. 로그인에서 다시 시도해주세요.'
        : '로그인에 실패했습니다. 다시 시도해주세요.',
    );
  }

  if (!isRecovery) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await ensureLabForUser(supabase, user);
    }
  }

  return response;
}
