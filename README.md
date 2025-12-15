# 아카츠키 토벌 경매 시스템

길드2 전용 토벌 경매 시스템입니다.

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정:
`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Discord OAuth 설정
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Pusher 설정
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_app_key
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster
```

3. 개발 서버 실행:
```bash
npm run dev
```

## 데이터베이스

이 프로젝트는 기존 Supabase 데이터베이스의 `items_guild2`와 `bid_history_guild2` 테이블을 사용합니다.

## 기능

- 아카츠키 길드 전용 토벌 경매
- 실시간 입찰 시스템
- 관리자 기능 (아이템 추가/수정/삭제)
- 완료된 경매 내역 엑셀 다운로드
- Discord 로그인 연동

## 기술 스택

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- NextAuth.js (Discord Provider)
- Supabase
- Pusher (실시간 업데이트)
- ExcelJS (엑셀 다운로드)