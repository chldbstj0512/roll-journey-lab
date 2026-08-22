function withHttps(host: string) {
  const trimmed = host.replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isEphemeralVercelHost(host: string) {
  return host.includes('-projects.vercel.app');
}

export function getServerAppOrigin(request: { url: string; headers: { get(name: string): string | null } }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return withHttps(site);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return withHttps(production);

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !isEphemeralVercelHost(forwardedHost)) {
    return `${proto}://${forwardedHost}`;
  }

  const requestHost = new URL(request.url).host;
  if (isEphemeralVercelHost(requestHost)) {
    return 'https://roll-journey-lab-indol.vercel.app';
  }

  return new URL(request.url).origin;
}

export function getPublicAppOrigin() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : '');

  if (typeof window === 'undefined') {
    return envUrl;
  }

  const origin = window.location.origin;
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
  if (isLocal && envUrl) {
    return envUrl;
  }
  if (isEphemeralVercelHost(new URL(origin).host) && envUrl) {
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
