# 쓰는 서비스 한눈에

Roll & Journey는 앱이 두 개다.

| 무엇 | 어디 | 지금 주소 / ID |
| --- | --- | --- |
| 현상소 웹 | `roll-journey-lab` (이 레포) | https://roll-journey-lab-indol.vercel.app |
| 사용자 앱 | `roll-journey` (Expo) | 앱스토어 배포 예정. Vercel에 안 올림 |

둘 다 같은 운영 Supabase를 본다. 사진 파일은 Cloudflare R2.

```
사용자 앱 (Expo)          현상소 웹 (Next.js / Vercel)
        \                    /
         \                  /
          →  Supabase (로그인·DB)
          →  Cloudflare R2 (스캔 사진)
```

---

## Vercel

- **하는 일:** 현상소 웹 호스팅. GitHub `main` 푸시하면 빌드.
- **고정 주소:** https://roll-journey-lab-indol.vercel.app  
  배포마다 생기는 `*-projects.vercel.app` 는 쓰지 않는다. 카카오/메일 리다이렉트가 깨진다.
- **넣는 값:** `NEXT_PUBLIC_SUPABASE_*`, `R2_*`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL`
- **넣지 말 것:** 운영 Supabase `DATABASE_URL` (Prisma 로컬 DB용이다)
- **안 하는 일:** 사용자 앱 배포, 메일 발송, 파일 저장

환경 변수를 바꾸면 **Redeploy** 해야 한다.

---

## GitHub

- **레포:** https://github.com/chldbstj0512/roll-journey-lab.git
- Vercel이 이 레포의 `main`을 빌드한다.

---

## Supabase

- **프로젝트 ID:** `zdplcnopfeyiesyywtno`
- **하는 일:** 이메일 가입/로그인, 세션, `labs`/`orders` 등 MVP DB, 인증 메일 발송
- **대시보드:** https://supabase.com/dashboard/project/zdplcnopfeyiesyywtno
- **Site URL:** `https://roll-journey-lab-indol.vercel.app`  
  Redirect: `https://roll-journey-lab-indol.vercel.app/**`  
  `trycloudflare.com` 금지
- **카카오 프로바이더:** Client ID/Secret + Allow users without an email. 실제 카카오 인가는 우리 `/auth/kakao/*`가 한다.
- **메일 템플릿:** 인증번호 `{{ .Token }}`. 링크만 있으면 예전 터널로 가서 실패한다. → [email-login.md](email-login.md)
- **안 하는 일:** 사진 파일 저장 (R2), 웹 호스팅 (Vercel)

운영 DB는 MVP 3테이블이다. 로컬 Prisma 스키마를 이 프로젝트에 적용하지 않는다.

---

## 카카오 로그인

- **하는 일:** 현상소 웹 소셜 로그인. 카카오 계정 → OpenID `id_token` → Supabase 세션
- **콘솔:** https://developers.kakao.com
- **Redirect URI (REST API 키 아래, 로그인 일반 탭 아님):**

```
https://roll-journey-lab-indol.vercel.app/auth/kakao/callback
```

- **켤 것:** 카카오 로그인 ON, OpenID Connect ON, Client Secret ON
- **안 켜도 됨:** 이메일 / 닉네임 / 프로필 사진 동의. 카카오 메일은 가짜일 수 있어서 연락처로 안 씀
- **상세:** [kakao-login.md](kakao-login.md)

---

## Cloudflare

쓰는 것은 **R2 파일 저장**뿐이다.

- **R2:** 스캔 사진 버킷. 웹이 업로드하고 공개 URL로 보여 준다.
- **안 쓰는 것:** 예전에 폰 테스트용으로 켠 `*.trycloudflare.com` 임시 터널. 주소가 금방 죽어서 메일 링크가 “네트워크 유실”이 났다. **인증에 다시 쓰지 않는다.**

---

## 로컬 개발만 (운영과 분리)

| 무엇 | 하는 일 |
| --- | --- |
| Node.js | Next.js 실행 |
| Docker / Colima | 로컬 Postgres |
| Prisma | v0.2 스키마. `DATABASE_URL` → `localhost:5432` only |
| `npm run dev` | http://localhost:3000 |

로컬 Postgres ≠ 운영 Supabase. 운영 URL을 `DATABASE_URL`에 넣지 않는다.

---

## 사용자 앱 (`roll-journey`)

- Expo / React Native
- 같은 Supabase, 같은 R2를 쓸 예정
- 배포는 앱스토어. Vercel 아님

---

## 일부러 안 쓰는 것

- **AWS 웹 호스팅** — 지금은 Vercel
- **Cloudflare 터널로 메일 인증** — 금지
- **Supabase 기본 Kakao OAuth** — 동의 3종을 강제해서 우리 OpenID 경로를 씀

---

## 관련 문서

- [kakao-login.md](kakao-login.md)
- [email-login.md](email-login.md)
