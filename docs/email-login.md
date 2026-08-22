# 이메일 로그인 / 인증 메일

운영 사이트: https://roll-journey-lab-indol.vercel.app/login  
Supabase 프로젝트: `zdplcnopfeyiesyywtno`

앱 코드는 **6자리 인증번호**를 기다린다. 메일에 링크만 오면 예전 Cloudflare 주소로 가서 “네트워크 유실”이 난다. 제목 `Reset your password` / 발신 `Supabase Auth`도 대시보드 템플릿을 안 바꿨을 때 그대로다.

코드만으로는 메일 본문·제목·발신자를 바꿀 수 없다. 아래를 **Supabase에 붙여넣어야** 한다.

---

## 1) Site URL (링크가 죽지 않게)

https://supabase.com/dashboard/project/zdplcnopfeyiesyywtno/auth/url-configuration

- **Site URL**

```
https://roll-journey-lab-indol.vercel.app
```

- **Redirect URLs**에 추가

```
https://roll-journey-lab-indol.vercel.app/**
```

`trycloudflare.com` 주소는 전부 지운다. 끝 `/` 넣지 않는다.

---

## 2) Reset password 템플릿 (비밀번호 찾기 인증번호)

Authentication → Email Templates → **Reset password**

- Subject:

```
[ROLL & JOURNEY] 비밀번호 인증번호
```

- Body (저장소 `supabase/templates/recovery.html`과 동일):

```html
<h2>비밀번호 재설정</h2>
<p>ROLL & JOURNEY 현상소 계정의 인증번호입니다.</p>
<p style="font-size:28px;letter-spacing:8px;font-weight:700;">{{ .Token }}</p>
<p>사이트에 이 번호를 입력하세요. 메일 속 링크는 누르지 마세요. 번호는 잠시 후 만료됩니다.</p>
```

`{{ .Token }}`이 있어야 6자리 숫자가 간다. 기본 템플릿의 `{{ .ConfirmationURL }}`만 있으면 죽은 링크만 간다.

---

## 3) Confirm signup 템플릿 (가입 인증번호)

Authentication → Email Templates → **Confirm signup**

- Subject:

```
[ROLL & JOURNEY] 이메일 인증번호
```

- Body (`supabase/templates/confirm-signup.html`):

```html
<h2>이메일 인증</h2>
<p>ROLL & JOURNEY 현상소 가입 인증번호입니다.</p>
<p style="font-size:28px;letter-spacing:8px;font-weight:700;">{{ .Token }}</p>
<p>사이트에 이 번호를 입력하세요. 메일 속 링크는 누르지 마세요.</p>
```

---

## 4) 발신자가 여전히 `Supabase Auth`인 경우

제목/본문은 위 템플릿으로 바뀐다. **From 이름**은 Authentication → **SMTP Settings**에 자체 메일(Gmail, Resend 등)을 넣어야 바뀐다. 기본 발신자는 코드로 못 바꾼다.

---

## 앱에서 하는 일

| 상황 | 동작 |
| --- | --- |
| 로그인 비밀번호 오류 (가입된 메일) | 그 메일로 재설정 인증번호 발송 → 번호 입력 → 새 비밀번호 |
| 로그인 시 이메일 미인증 | 가입 인증번호 재발송 → 번호 입력 → 대시보드 |
| 회원가입 (세션 없음) | 인증번호 화면 → 번호 입력 → 대시보드 |

관련 파일:

- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `components/email-otp-form.tsx`
- `supabase/templates/recovery.html`
- `supabase/templates/confirm-signup.html`

이미 받은 메일은 예전 링크라 실패한다. 템플릿/Site URL을 저장한 뒤 **새로 로그인·가입**해서 메일을 다시 받는다. 메일의 **숫자만** 넣고 링크는 누르지 않는다.
