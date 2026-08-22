export function getPublicAppOrigin() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/$/, '')}`
      : '');

  if (typeof window === 'undefined') {
    return envUrl;
  }

  const origin = window.location.origin;
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
  if (isLocal && envUrl) {
    return envUrl;
  }
  return origin;
}

export function authConfirmUrl(next?: string) {
  const origin =
    getPublicAppOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL('/auth/confirm', origin);
  if (next) {
    url.searchParams.set('next', next);
  }
  return url.toString();
}
