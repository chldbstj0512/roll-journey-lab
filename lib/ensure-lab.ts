import type { SupabaseClient, User } from '@supabase/supabase-js';

function isKakaoUser(user: User) {
  return (
    user.app_metadata?.provider === 'kakao' ||
    user.identities?.some((identity) => identity.provider === 'kakao') === true
  );
}

function labErrorMessage(error: { message?: string; code?: string; status?: number }) {
  const blob = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (error.code === '23505' || blob.includes('duplicate')) {
    return null;
  }
  if (
    error.code === '42501' ||
    error.status === 401 ||
    blob.includes('row-level security') ||
    blob.includes('permission') ||
    blob.includes('jwt')
  ) {
    return '현상소 정보를 저장할 수 없습니다. 이메일 인증 후 다시 로그인해주세요.';
  }
  return error.message?.trim() || '현상소 정보 저장에 실패했습니다.';
}

export async function ensureLabForUser(
  supabase: SupabaseClient,
  user: User,
  labNameFallback?: string,
) {
  const kakao = isKakaoUser(user);
  const name =
    (labNameFallback && labNameFallback.trim()) ||
    (typeof user.user_metadata?.lab_name === 'string' && user.user_metadata.lab_name.trim()) ||
    (kakao
      ? '현상소'
      : (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
        '현상소');
  // Kakao emails are often placeholders. Never treat them as a real lab contact.
  const email = kakao
    ? `${user.id}@kakao.local`
    : user.email?.trim() ||
      (typeof user.user_metadata?.email === 'string' && user.user_metadata.email.trim()) ||
      `${user.id}@account.local`;

  const { data: existing, error: selectError } = await supabase
    .from('labs')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    const message = labErrorMessage(selectError);
    if (message) return { error: message };
  }

  if (existing) {
    return { error: null };
  }

  const { error: insertError } = await supabase.from('labs').insert({
    id: user.id,
    name,
    email,
  });

  if (insertError) {
    return { error: labErrorMessage(insertError) };
  }

  return { error: null };
}
