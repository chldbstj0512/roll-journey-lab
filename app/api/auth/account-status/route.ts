import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let email = '';
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ exists: null }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ exists: null }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.getUserByEmail(email);
    if (data?.user) {
      return NextResponse.json({ exists: true });
    }
    const notFound =
      error?.status === 404 ||
      (error?.message ?? '').toLowerCase().includes('not found') ||
      (error?.message ?? '').toLowerCase().includes('unable to find');
    if (notFound || !error) {
      return NextResponse.json({ exists: false });
    }
  }

  if (url && anonKey) {
    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc('auth_email_registered', {
      check_email: email,
    });
    if (!error && typeof data === 'boolean') {
      return NextResponse.json({ exists: data });
    }
  }

  return NextResponse.json({ exists: null });
}
