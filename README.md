# Roll & Journey - Lab (현상소 관리 시스템)

필름 현상소를 위한 주문 관리 및 스캔 사진 업로드 시스템

## 🎯 프로젝트 개요

**Roll & Journey**는 필름 사진을 사랑하는 사람들을 위한 통합 플랫폼입니다.

### 핵심 컨셉
- **사용자**: 필름을 맡기고, 스캔된 사진을 아카이브로 관리
- **현상소**: 주문 접수, 스캔 사진 업로드, 고객에게 자동 전달

### 서비스 구조
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   사용자 앱      │     │   현상소 웹      │     │   Cloudflare R2 │
│  (Roll & Journey)│ ←── │  (이 프로젝트)   │ ──→ │   (사진 저장소)  │
│   iOS/Android   │     │   PC 브라우저    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         └──────────────────────┴───────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │    Supabase     │
                    │  (DB + Auth)    │
                    └─────────────────┘
```

---

## 📱 전체 기획안

### Phase 1: MVP (현재 진행 중)
- [x] 현상소 웹 - 로그인/회원가입
- [x] 현상소 웹 - 대시보드 (주문 목록)
- [x] 현상소 웹 - 새 주문 등록
- [x] 현상소 웹 - 주문 상세 + 상태 변경
- [x] 현상소 웹 - 스캔 사진 드래그앤드롭 업로드
- [x] 사용자 앱 - Rolls 탭 (필름 아카이브 리스트)
- [x] 사용자 앱 - 롤 상세 (풀스크린 사진 뷰어 + 즐겨찾기)
- [ ] Cloudflare R2 연동 (실제 업로드)
- [ ] 사용자 앱 - Journey 탭 (현상소 지도)
- [ ] 현상소 → 사용자 연동 (업로드된 사진 자동 연결)

### Phase 2: 핵심 기능
- [ ] 메일인 접수 시스템 (택배 연동)
- [ ] 결제 시스템 (토스페이먼츠)
- [ ] 알림 (카카오톡/푸시)
- [ ] 현상소 가격표 관리
- [ ] 사용자 롤 직접 업로드

### Phase 3: 확장
- [ ] 현상소 리뷰/평점
- [ ] 필름 레시피 공유
- [ ] 커뮤니티 기능

---

## 🛠 기술 스택

### 현상소 웹 (이 프로젝트)
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Auth/DB**: Supabase
- **Storage**: Cloudflare R2
- **Language**: TypeScript

### 사용자 앱 (roll-journey)
- **Framework**: React Native + Expo
- **Navigation**: Expo Router
- **Styling**: StyleSheet + Custom Theme

---

## 🚀 로컬 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env.local` 파일 생성:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=roll-journey
R2_PUBLIC_URL=https://your-r2-domain.com
```

### 3. Supabase 테이블 생성
`supabase-schema.sql` 파일을 Supabase SQL Editor에서 실행

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. v0.2 스키마 (로컬 Postgres만)

현재 운영 Supabase는 MVP 3테이블이다. 새 스키마를 그 프로젝트에 적용하지 않는다.

```bash
cp .env.example .env   # DATABASE_URL → 로컬 Postgres
docker compose up -d
npx prisma migrate deploy
npx prisma generate
```

새 Supabase 개발 프로젝트에는 `docs/architecture/schema.sql`을 쓴다 (`auth.users` FK + RLS).

---

## 📁 프로젝트 구조

```
roll-journey-lab/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx      # 로그인
│   │   └── signup/page.tsx     # 회원가입
│   ├── auth/
│   │   └── callback/page.tsx   # 이메일 인증 콜백
│   ├── dashboard/page.tsx      # 대시보드
│   ├── orders/
│   │   ├── new/page.tsx        # 새 주문
│   │   └── [id]/page.tsx       # 주문 상세 + 사진 업로드
│   ├── api/
│   │   └── upload/route.ts     # 사진 업로드 API
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts             # Supabase 클라이언트
│   ├── supabase-server.ts      # 서버사이드 Supabase
│   ├── r2.ts                   # Cloudflare R2 클라이언트
│   └── types.ts                # 타입 정의
├── middleware.ts               # 인증 미들웨어
├── supabase-schema.sql         # DB 스키마
└── .env.example
```

---

## ✅ 다음에 할 일 (TODO)

### 즉시 해야 할 것
1. **Cloudflare R2 설정**
   - R2 버킷 생성
   - API 토큰 발급
   - 퍼블릭 도메인 연결
   - `.env.local`에 R2 정보 추가

2. **Supabase 이메일 템플릿 커스터마이징**
   - 한글 이메일 템플릿
   - Roll & Journey 브랜딩

3. **사용자 앱 Journey 탭 완성**
   - 현상소 지도 (Google Maps)
   - 현상소 상세 정보

### 그 다음
4. **현상소 ↔ 사용자 연동**
   - 현상소가 업로드한 사진을 사용자 앱에서 볼 수 있도록
   - 주문 코드로 연결

5. **실제 배포**
   - Vercel 배포 (현상소 웹)
   - 도메인 연결
   - 사용자 앱 빌드 (iOS/Android)

---

## 🔗 관련 프로젝트

- `roll-journey/` - 사용자용 모바일 앱 (Expo)

---

## 📝 메모

- Supabase 프로젝트 ID: `zdplcnopfeyiesyywtno`
- 개발 터널 URL: `https://autos-digit-clearance-corner.trycloudflare.com` (임시)
