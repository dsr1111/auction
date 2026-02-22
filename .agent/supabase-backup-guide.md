# Supabase 데이터 복구 가이드

## 1. 현재 백업 상태 확인

### Supabase Dashboard에서 확인
1. [Supabase Dashboard](https://app.supabase.com) 로그인
2. 프로젝트 선택
3. **Settings** → **Database** → **Backups** 탭
4. 사용 가능한 백업 목록 확인

### 플랜별 백업 보존 기간
- **Free**: 7일
- **Pro**: 30일
- **Team/Enterprise**: 90일+

---

## 2. 백업으로 복구하기

### 옵션 A: Supabase Dashboard 사용 (추천)
```
1. Dashboard → Settings → Database → Backups
2. 복구할 백업 선택
3. "Restore" 버튼 클릭
⚠️ 주의: 현재 데이터베이스가 선택한 백업으로 덮어씌워집니다
```

### 옵션 B: 특정 테이블만 복구
1. 백업을 새 프로젝트로 복구
2. SQL Editor에서 특정 데이터만 추출
3. 원본 프로젝트로 데이터 이동

---

## 3. 삭제된 아이템 복구 시나리오

### 3-1. 백업이 있는 경우 (삭제 전 백업)
```sql
-- 1. 백업에서 복구한 임시 프로젝트에서 실행
-- 2. 삭제된 아이템 조회
SELECT * FROM items WHERE end_time < NOW() AND end_time > '2025-12-17'::timestamp;

-- 3. 입찰 내역과 함께 추출
SELECT 
  i.*,
  json_agg(
    json_build_object(
      'bid_amount', bh.bid_amount,
      'bidder_nickname', bh.bidder_nickname,
      'bid_quantity', bh.bid_quantity,
      'created_at', bh.created_at
    ) ORDER BY bh.bid_amount DESC
  ) as winning_bids
FROM items i
LEFT JOIN bid_history bh ON bh.item_id = i.id
WHERE i.end_time < NOW()
GROUP BY i.id;

-- 4. 결과를 auction_results_archive 테이블에 저장
```

### 3-2. 백업이 없는 경우
❌ 복구 불가능 - 앞으로를 위한 대책 필요

---

## 4. 앞으로의 데이터 보호 전략

### 방법 1: 삭제 전 아카이브 (추천)
```sql
-- cleanup 전에 실행
INSERT INTO auction_results_archive (
  item_id, item_name, starting_price, quantity,
  end_time, winning_bids, total_winning_amount
)
SELECT 
  i.id,
  i.name,
  i.price,
  i.quantity,
  i.end_time,
  (SELECT json_agg(...)::jsonb FROM bid_history WHERE item_id = i.id),
  (SELECT SUM(bid_amount) FROM bid_history WHERE item_id = i.id)
FROM items i
WHERE i.end_time < NOW();
```

### 방법 2: Soft Delete
```sql
-- items 테이블에 컬럼 추가
ALTER TABLE items ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- cleanup시 실제 삭제 대신
UPDATE items 
SET is_deleted = true, deleted_at = NOW()
WHERE end_time < NOW();
```

### 방법 3: PostgreSQL Write-Ahead Log (WAL)
- PITR 활성화하면 자동으로 WAL 사용
- Pro 플랜 이상에서 가능

---

## 5. 수동 백업 자동화 (Free 플랜용)

### GitHub Actions로 자동 백업
```yaml
# .github/workflows/db-backup.yml
name: Database Backup
on:
  schedule:
    - cron: '0 2 * * *' # 매일 새벽 2시
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          pg_dump $SUPABASE_DB_URL > backup_$(date +%Y%m%d).sql
          
      - name: Upload to Cloud Storage
        # S3, Google Drive 등에 업로드
```

---

## 6. 즉시 실행 가능한 체크리스트

- [ ] Supabase Dashboard에서 현재 백업 상태 확인
- [ ] 삭제된 데이터가 포함된 백업이 있는지 확인
- [ ] 백업이 있으면 → 복구 진행
- [ ] 백업이 없으면 → 앞으로를 위한 아카이브 시스템 구축
- [ ] Pro 플랜 업그레이드 검토 (PITR 필요시)

---

## 7. 긴급 복구 절차

### 지금 당장 삭제된 데이터 복구가 필요한 경우
```
1. Supabase Dashboard → Settings → Database → Backups
2. 가장 최근 백업 (삭제 전) 확인
3. 백업이 있다면:
   a. 새 테스트 프로젝트 생성
   b. 백업을 테스트 프로젝트에 복구
   c. SQL Editor에서 필요한 데이터만 추출
   d. 원본 프로젝트의 새 테이블에 데이터 삽입
4. 백업이 없다면:
   - Supabase Support에 연락 (혹시 모를 추가 백업)
   - 복구 불가능 → 재발 방지 시스템 구축
```

---

## 참고 링크
- [Supabase Backups Documentation](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)
