import { createHmac, timingSafeEqual } from 'node:crypto';

type KakaoOAuthState = {
  redirectUri: string;
  exp: number;
};

export function kakaoCredentials() {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

export function createKakaoOAuthState(redirectUri: string, secret: string) {
  const payload: KakaoOAuthState = {
    redirectUri,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readKakaoOAuthState(state: string, secret: string): KakaoOAuthState | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as KakaoOAuthState;
    if (!payload.redirectUri || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
