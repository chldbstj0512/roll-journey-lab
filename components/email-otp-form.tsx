'use client';

type EmailOtpFormProps = {
  email: string;
  otp: string;
  loading: boolean;
  error: string;
  onOtpChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
};

export function EmailOtpForm({
  email,
  otp,
  loading,
  error,
  onOtpChange,
  onSubmit,
  onResend,
}: EmailOtpFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-[#888]">
        <span className="text-white">{email}</span>로 6자리 인증번호를 보냈습니다.
        메일의 숫지만 입력하세요. 링크는 누르지 마세요.
      </p>
      <div>
        <label className="block text-sm text-[#888] mb-2">인증번호</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => onOtpChange(e.target.value)}
          className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg focus:outline-none focus:border-[#c41e3a] transition-colors tracking-[0.4em] text-center text-lg"
          placeholder="000000"
          required
        />
      </div>
      {error && <p className="text-[#c41e3a] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#c41e3a] hover:bg-[#a01830] rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {loading ? '확인 중...' : '확인'}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onResend}
        className="w-full py-3 text-sm text-[#888] hover:text-white"
      >
        인증번호 다시 보내기
      </button>
    </form>
  );
}
