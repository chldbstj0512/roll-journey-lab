type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

export function mapAuthError(
  error: AuthLikeError,
  fallback = '요청을 처리할 수 없습니다. 다시 시도해주세요.',
) {
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return '이메일 인증이 아직 완료되지 않았습니다. 메일함을 확인해주세요.';
  }
  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already exists')
  ) {
    return '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.';
  }
  if (code === 'weak_password' || message.includes('password should be at least')) {
    return '비밀번호는 6자 이상이어야 합니다.';
  }
  if (code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }
  if (code === 'user_not_found' || message.includes('user not found')) {
    return '등록되지 않은 이메일입니다.';
  }
  if (message.includes('same password') || message.includes('should be different')) {
    return '이전과 다른 비밀번호를 입력해주세요.';
  }
  if (message.includes('expired') || code === 'otp_expired') {
    return '링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해주세요.';
  }

  return error.message?.trim() || fallback;
}

export function isDuplicateSignup(user: { identities?: Array<unknown> | null } | null) {
  return Boolean(user) && (user?.identities?.length ?? 0) === 0;
}
