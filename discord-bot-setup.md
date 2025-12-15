# Discord 봇 초대 링크 생성 방법

## 1. Discord Developer Portal에서

### A. OAuth2 탭으로 이동
1. 화면 왼쪽의 **OAuth2** 탭 클릭
2. **URL Generator** 섹션으로 이동

### B. 권한 설정
**SCOPES** (권한 범위):
- ✅ `bot` (봇 초대)
- ✅ `identify` (사용자 정보 확인)
- ✅ `guilds` (서버 목록 확인)
- ✅ `guilds.members.read` (멤버 정보 읽기)

**BOT PERMISSIONS** (봇 권한):
- ✅ **Administrator** (관리자 권한 - 모든 권한 포함)

### C. 생성된 URL 복사
URL Generator 하단에 생성된 URL을 복사하세요.

## 2. 봇 초대

1. 복사한 URL을 브라우저 주소창에 붙여넣기
2. 봇을 추가할 **디스코드 서버를 선택**
3. 권한 확인 후 **승인** 버튼 클릭

## 3. 봇이 서버에 추가되면

서버 설정 → 역할(Roles)에서 봇에게 적절한 역할을 부여해야 합니다.
- 봇을 **역할 목록 상단**으로 이동 (권한 우선순위)
- 필요한 권한이 있는 역할을 봇에게 부여

## 완료!

이제 봇이 서버에 추가되었습니다. `.env.local` 파일의 환경 변수를 설정하면 됩니다.




























