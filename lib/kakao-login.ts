const STATE_COOKIE = 'kakao_oauth_state';
const REDIRECT_COOKIE = 'kakao_oauth_redirect';

export function kakaoCredentials() {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

export function kakaoCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 10 * 60,
  };
}

export function kakaoCookieNames() {
  return { STATE_COOKIE, REDIRECT_COOKIE };
}
