import { NextRequest, NextResponse } from 'next/server';
import { getServerAppOrigin } from '@/lib/auth-redirect';
import { createKakaoOAuthState, kakaoCredentials } from '@/lib/kakao-login';

export async function GET(request: NextRequest) {
  const origin = getServerAppOrigin(request);
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  const creds = kakaoCredentials();
  if (!creds) {
    return fail('카카오 로그인 키가 없습니다. Vercel에 KAKAO_REST_API_KEY와 KAKAO_CLIENT_SECRET을 넣어주세요.');
  }

  const redirectUri = `${origin}/auth/kakao/callback`;
  const authorize = new URL('https://kauth.kakao.com/oauth/authorize');
  authorize.searchParams.set('client_id', creds.clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('response_type', 'code');
  // Do not request account_email / profile_image / profile_nickname.
  authorize.searchParams.set('scope', 'openid');
  authorize.searchParams.set('state', createKakaoOAuthState(redirectUri, creds.clientSecret));

  return NextResponse.redirect(authorize);
}
