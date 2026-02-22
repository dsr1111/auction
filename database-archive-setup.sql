-- 경매 낙찰 결과 아카이브 테이블 (길드1용)
CREATE TABLE IF NOT EXISTS auction_results_archive (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  starting_price INTEGER NOT NULL,
  final_bid INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winning_bids JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_winning_amount INTEGER DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_item_id ON auction_results_archive(item_id);
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_end_time ON auction_results_archive(end_time);
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_archived_at ON auction_results_archive(archived_at);

-- 테이블 설명
COMMENT ON TABLE auction_results_archive IS '마감된 경매 아이템의 낙찰 결과를 영구 보존하는 아카이브 테이블';
COMMENT ON COLUMN auction_results_archive.item_id IS '원본 아이템 ID (items 테이블에서 삭제되어도 보존)';
COMMENT ON COLUMN auction_results_archive.item_name IS '아이템명';
COMMENT ON COLUMN auction_results_archive.starting_price IS '시작 가격';
COMMENT ON COLUMN auction_results_archive.final_bid IS '최종 낙찰가';
COMMENT ON COLUMN auction_results_archive.quantity IS '아이템 수량';
COMMENT ON COLUMN auction_results_archive.end_time IS '경매 마감 시간';
COMMENT ON COLUMN auction_results_archive.winning_bids IS '낙찰 정보 JSON (입찰내역에서 추출)';
COMMENT ON COLUMN auction_results_archive.total_winning_amount IS '총 낙찰 금액';
COMMENT ON COLUMN auction_results_archive.archived_at IS '아카이브 저장 시간';

-- RLS 설정
ALTER TABLE auction_results_archive ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 아카이브를 읽을 수 있음
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auction_results_archive' 
    AND policyname = 'Users can view auction results archive'
  ) THEN
    CREATE POLICY "Users can view auction results archive" ON auction_results_archive
      FOR SELECT USING (true);
  END IF;
END $$;

-- 관리자만 아카이브에 쓸 수 있음
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auction_results_archive' 
    AND policyname = 'Admins can manage auction results archive'
  ) THEN
    CREATE POLICY "Admins can manage auction results archive" ON auction_results_archive
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'isAdmin' = 'true'
      );
  END IF;
END $$;


-- 경매 낙찰 결과 아카이브 테이블 (길드2용)
CREATE TABLE IF NOT EXISTS auction_results_archive_guild2 (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  starting_price INTEGER NOT NULL,
  final_bid INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winning_bids JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_winning_amount INTEGER DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_guild2_item_id ON auction_results_archive_guild2(item_id);
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_guild2_end_time ON auction_results_archive_guild2(end_time);
CREATE INDEX IF NOT EXISTS idx_auction_results_archive_guild2_archived_at ON auction_results_archive_guild2(archived_at);

-- 테이블 설명
COMMENT ON TABLE auction_results_archive_guild2 IS '길드2 마감된 경매 아이템의 낙찰 결과를 영구 보존하는 아카이브 테이블';

-- RLS 설정
ALTER TABLE auction_results_archive_guild2 ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽고 쓸 수 있음 (길드2용)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auction_results_archive_guild2' 
    AND policyname = 'Allow all operations on auction_results_archive_guild2'
  ) THEN
    CREATE POLICY "Allow all operations on auction_results_archive_guild2" ON auction_results_archive_guild2
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
