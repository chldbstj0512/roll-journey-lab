# 카카오 로그인 (현상소 웹)

운영 사이트: https://roll-journey-lab-indol.vercel.app/login  
Supabase 프로젝트: `zdplcnopfeyiesyywtno`

이 문서는 카카오 개발자 콘솔이 개편된 뒤(리다이렉트 URI가 로그인 일반 탭에서 사라짐) 기준으로 적었다.

---

## 왜 Supabase `signInWithOAuth({ provider: 'kakao' })`를 안 쓰나

Supabase Auth의 Kakao 프로바이더는 서버에서 아래 세 스코프를 **무조건** 붙인다.

- `account_email`
- `profile_nickname`
- `profile_image`

앱 코드에서 `scopes`를 빼도 **추가만** 되고, 기본 세 개는 지워지지 않는다.  
카카오 앱에 그 동의 항목이 없으면 `KOE205` (설정하지 않은 동의 항목을 요청함)가 난다.

그래서 로그인은 우리 서버가 카카오에 `openid`만 요청하고, 받은 ID 토큰으로 Supabase `signInWithIdToken`을 쓴다.

카카오 이메일은 가짜/미등록일 수 있다. 현상소 연락처·비밀번호 찾기로 쓰지 않는다.

---

## 코드 위치

| 역할 | 파일 |
| --- | --- |
| 로그인 버튼 | `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx` → `/auth/kakao/start` |
| 카카오 인가 시작 (`scope=openid`) | `app/auth/kakao/start/route.ts` |
| 카카오 콜백 + Supabase 세션 | `app/auth/kakao/callback/route.ts` |
| REST 키/시크릿, state 서명 | `lib/kakao-login.ts` |
| 고정 사이트 주소 (배포용 임시 도메인 방지) | `lib/auth-redirect.ts` (`getServerAppOrigin`) |
| 카카오 유저 랩 행 (가짜 메일 미사용) | `lib/ensure-lab.ts` |

흐름:

1. 버튼 → `GET /auth/kakao/start`
2. 카카오 동의 화면 (`scope=openid`만)
3. 카카오 → `GET /auth/kakao/callback?code=&state=`
4. 인가 코드를 카카오 토큰으로 교환 → `id_token`
5. `supabase.auth.signInWithIdToken({ provider: 'kakao', token })`
6. `ensureLabForUser` 후 `/dashboard`

`state`는 쿠키가 아니라 HMAC 서명한 값이다. Vercel 배포 URL과 고정 도메인이 달라서 쿠키가 빠지면 “세션이 만료되었습니다”가 났었다.

---

## 환경 변수 (Vercel + 로컬 `.env.local`)

GitHub에 넣지 말 것. `NEXT_PUBLIC_` 붙이지 말 것.

```
KAKAO_REST_API_KEY=     # 카카오 REST API 키 = Supabase Kakao Client ID
KAKAO_CLIENT_SECRET=    # 카카오 Client Secret (활성화 ON인 현재 값)
NEXT_PUBLIC_SITE_URL=https://roll-journey-lab-indol.vercel.app
```

Vercel: Settings → Environment Variables → Production **and** Preview  
값을 바꾸면 **Redeploy** 해야 적용된다. 따옴표/공백 없이 붙여넣기.

---

## 1) 카카오 개발자 콘솔

사이트: https://developers.kakao.com → 내 애플리케이션

### REST API 키 / Redirect URI / Client Secret

**카카오 로그인 → 일반 탭에는 Redirect URI가 없다.** (2026 개편)

1. 왼쪽 **앱** → **플랫폼 키**
2. **REST API 키** 카드 클릭 (대표 키)
3. **카카오 로그인 리다이렉트 URI**에 **우리 사이트만** 등록:

```
https://roll-journey-lab-indol.vercel.app/auth/kakao/callback
```

넣지 말 것:

- `https://zdplcnopfeyiesyywtno.supabase.co/auth/v1/callback` (예전 Supabase OAuth용. 지금 플로우 아님)
- `https://….vercel.app/login`
- `https://….‑projects.vercel.app/…` (배포마다 바뀌는 임시 주소)

4. 같은 화면에서 **카카오 로그인 Client Secret** ON → 값 복사 → `KAKAO_CLIENT_SECRET`

### 카카오 로그인 ON + OpenID Connect ON

1. 왼쪽 **제품** → **카카오 로그인** → **일반**
2. **사용 설정** ON (꺼져 있으면 OpenID 칸이 안 보임)
3. **OpenID Connect** ON

**동의 항목**(이메일/닉네임/프로필 사진)은 켜지 않아도 된다. 이 앱은 `openid`만 요청한다.

---

## 2) Supabase

https://supabase.com/dashboard/project/zdplcnopfeyiesyywtno/auth/providers

1. Authentication → Sign In / Providers → **Kakao**
2. Enable Kakao ON
3. **Client ID** = 카카오 REST API 키
4. **Client Secret** = 카카오 Client Secret
5. **Allow users without an email** ON (카카오 메일을 신뢰하지 않음)
6. Save

URL Configuration Redirect URLs에도 운영 주소를 둔다.

```
https://roll-journey-lab-indol.vercel.app/**
```

---

## 3) 테스트할 때

이 주소로만 들어간다.

https://roll-journey-lab-indol.vercel.app/login

Vercel Deployments의 긴 `*-projects.vercel.app` 주소로 들어가면 카카오 Redirect URI와 안 맞는다.

---

## 자주 나는 오류

| 메시지 | 원인 | 할 일 |
| --- | --- | --- |
| 설정하지 않은 동의 항목: `account_email`, `profile_nickname`, `profile_image` | 예전 Supabase OAuth가 세 스코프를 요청함 | 지금 코드(`/auth/kakao/start`)가 배포됐는지 확인. 동의 항목을 억지로 켤 필요 없음 |
| 등록하지 않은 리다이렉트 URI. 사용한 URI가 `*-projects.vercel.app` | 임시 배포 호스트로 인가 요청 | 카카오에는 고정 `/auth/kakao/callback`만. 운영 로그인 URL로 재시도 |
| Bad client credentials | 인가(REST 키)는 됐는데 토큰 교환 시크릿이 틀림 | 카카오에서 시크릿 다시 복사 → Vercel `KAKAO_CLIENT_SECRET` 수정 → Redeploy |
| 카카오 로그인 키가 없습니다 | Vercel에 `KAKAO_*` 없음 | env 추가 후 Redeploy |
| 카카오 로그인 세션이 만료되었습니다 | (구) 쿠키 state가 콜백까지 안 따라옴 | `state` 서명 방식 코드가 배포됐는지 확인. 이전 카카오 창은 닫고 다시 시작 |
| OpenID Connect를 켜고 다시 시도 | `id_token` 없음 | 카카오 로그인 일반에서 OpenID Connect ON |
| Redirect URI가 일반 탭에 안 보임 | 메뉴 이전 | **앱 → 플랫폼 키 → REST API 키** |

카카오는 Redirect URI를 **글자 단위**로 비교한다. `http`/`https`, 끝 `/`, `/login` vs `/auth/kakao/callback`이 다르면 전부 실패다.

---

## 참고 링크

- 카카오 로그인 설정: https://developers.kakao.com/docs/ko/kakaologin/prerequisite
- 앱/플랫폼 키 (Redirect URI 위치): https://developers.kakao.com/docs/ko/app-setting/app
- Supabase Kakao: https://supabase.com/docs/guides/auth/social-login/auth-kakao  
  (문서의 `signInWithOAuth` + 동의 3종은 이 프로젝트와 다름. 우리는 ID 토큰 경로를 씀)
