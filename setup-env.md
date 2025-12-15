# 환경 변수 설정 방법

프로젝트를 실행하려면 `.env.local` 파일을 생성하고 다음 환경 변수들을 설정해야 합니다.

## .env.local 파일 생성 방법

1. 프로젝트 루트 디렉토리(`E:\auction_akatsuki`)에 `.env.local` 파일을 생성합니다.

2. 아래 내용을 복사하여 `.env.local` 파일에 붙여넣고 실제 값들을 입력하세요:

```env
# Discord OAuth 설정
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Supabase 설정 (기존 길드2 데이터베이스 사용)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Pusher 설정
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_app_key
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster
```

## 원본 프로젝트에서 값 복사하기

원본 프로젝트(`E:\wiki\auction`)의 `.env.local` 파일에서 값들을 복사할 수 있습니다:
1. 파일 탐색기에서 `E:\wiki\auction\.env.local` 파일을 열어보세요
2. 값을 복사하여 새 프로젝트의 `.env.local`에 붙여넣으세요

## 주의사항

- `NEXTAUTH_SECRET`는 새로 생성해야 합니다. 다음 명령어로 생성할 수 있습니다:
  ```
  openssl rand -base64 32
  ```
  
- 기존 Supabase 데이터베이스를 사용하므로 Supabase 관련 값들은 동일하게 사용하면 됩니다.
- Pusher 설정도 동일하게 사용하면 됩니다.

## 프로젝트 실행

환경 변수 설정 후:
```bash
npm run dev
```




























