import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { ensureLabForUser } from '@/lib/ensure-lab';
import { getServerAppOrigin } from '@/lib/auth-redirect';
import { kakaoCookieNames, kakaoCredentials } from '@/lib/kakao-login';

export async function GET(request: NextRequest) {
  const origin = getServerAppOrigin(request);
  const { searchParams } = new URL(request.url);
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const kakaoError = searchParams.get('error_description') || searchParams.get('error');
  if (kakaoError) {
    return fail('카카오 로그인이 취소되었거나 실패했습니다.');
  }
  if (!code || !state) {
    return fail('카카오 로그인 정보가 없습니다. 다시 시도해주세요.');
  }

  const cookies = kakaoCookieNames();
  const expectedState = request.cookies.get(cookies.STATE_COOKIE)?.value;
  const redirectUri = request.cookies.get(cookies.REDIRECT_COOKIE)?.value;
  if (!expectedState || expectedState !== state || !redirectUri) {
    return fail('카카오 로그인 세션이 만료되었습니다. 다시 시도해주세요.');
  }

  const creds = kakaoCredentials();
  if (!creds) {
    return fail('카카오 로그인 키가 없습니다.');
  }

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const tokenPayload = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenPayload.id_token) {
    return fail(
      tokenPayload.error_description ||
        '카카오 OpenID Connect를 켜고 다시 시도해주세요.',
    );
  }

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.delete(cookies.STATE_COOKIE);
  response.cookies.delete(cookies.REDIRECT_COOKIE);

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

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'kakao',
    token: tokenPayload.id_token,
    access_token: tokenPayload.access_token,
  });
  if (error) {
    return fail(error.message || '카카오 로그인에 실패했습니다.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await ensureLabForUser(supabase, user);
  }

  return response;
}
