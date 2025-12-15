-- 입찰 내역을 저장하는 테이블 생성
CREATE TABLE IF NOT EXISTS bid_history (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL,
  bidder_nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_bid_history_item_id ON bid_history(item_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_created_at ON bid_history(created_at);

-- 테이블 설명
COMMENT ON TABLE bid_history IS '아이템별 입찰 내역을 저장하는 테이블';
COMMENT ON COLUMN bid_history.item_id IS '입찰된 아이템의 ID';
COMMENT ON COLUMN bid_history.bid_amount IS '입찰 금액';
COMMENT ON COLUMN bid_history.bidder_nickname IS '입찰자 닉네임';
COMMENT ON COLUMN bid_history.created_at IS '입찰 시간';

-- 사용자 연락처 정보 테이블
CREATE TABLE IF NOT EXISTS user_contacts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  kakao_openchat_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);

-- RLS (Row Level Security) 설정
ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 연락처 정보만 읽고 수정할 수 있음
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_contacts' 
    AND policyname = 'Users can view and update their own contact info'
  ) THEN
    CREATE POLICY "Users can view and update their own contact info" ON user_contacts
      FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
  END IF;
END $$;

-- 모든 사용자는 다른 사용자의 연락처 정보를 읽을 수 있음 (거래를 위해)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_contacts' 
    AND policyname = 'Users can view other users contact info'
  ) THEN
    CREATE POLICY "Users can view other users contact info" ON user_contacts
      FOR SELECT USING (true);
  END IF;
END $$;

-- 경매 기본 아이템 테이블
CREATE TABLE IF NOT EXISTS auction_default_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auction_default_items_sort_order ON auction_default_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_auction_default_items_is_active ON auction_default_items(is_active);

-- RLS 설정
ALTER TABLE auction_default_items ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 기본 아이템을 관리할 수 있음
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auction_default_items' 
    AND policyname = 'Admins can manage all default items'
  ) THEN
    CREATE POLICY "Admins can manage all default items" ON auction_default_items
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'isAdmin' = 'true'
      );
  END IF;
END $$;

-- 모든 사용자는 활성화된 기본 아이템을 읽을 수 있음
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auction_default_items' 
    AND policyname = 'Users can view active default items'
  ) THEN
    CREATE POLICY "Users can view active default items" ON auction_default_items
      FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- 기본 아이템 데이터 삽입
INSERT INTO auction_default_items (name, price, quantity, sort_order) VALUES
('디지몬 코어', 1000, 1, 1),
('진화석', 500, 1, 2),
('경험치 포션', 200, 1, 3),
('스킬 포인트', 300, 1, 4),
('골드', 100, 1, 5)
ON CONFLICT DO NOTHING;

-- 길드2용 경매 테이블 (길드1과 완전히 분리된 데이터베이스)
CREATE TABLE IF NOT EXISTS items_guild2 (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  current_bid INTEGER NOT NULL,
  last_bidder_nickname TEXT,
  quantity INTEGER DEFAULT 1,
  remaining_quantity INTEGER DEFAULT 1,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_items_guild2_created_at ON items_guild2(created_at);
CREATE INDEX IF NOT EXISTS idx_items_guild2_end_time ON items_guild2(end_time);

-- 길드2용 입찰 내역 테이블
CREATE TABLE IF NOT EXISTS bid_history_guild2 (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items_guild2(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL,
  bid_quantity INTEGER DEFAULT 1,
  bidder_nickname TEXT NOT NULL,
  bidder_discord_id TEXT,
  bidder_discord_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_bid_history_guild2_item_id ON bid_history_guild2(item_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_guild2_created_at ON bid_history_guild2(created_at);

-- 테이블 설명
COMMENT ON TABLE items_guild2 IS '길드2 경매 아이템 테이블';
COMMENT ON TABLE bid_history_guild2 IS '길드2 입찰 내역 테이블';

-- RLS 설정 (items_guild2는 모든 사용자가 읽기/쓰기 가능하도록 설정)
ALTER TABLE items_guild2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_history_guild2 ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 items_guild2를 읽고 쓸 수 있도록 정책 생성
DO $$ 
BEGIN
  -- items_guild2 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'items_guild2' 
    AND policyname = 'Allow all operations on items_guild2'
  ) THEN
    CREATE POLICY "Allow all operations on items_guild2" ON items_guild2
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  -- bid_history_guild2 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bid_history_guild2' 
    AND policyname = 'Allow all operations on bid_history_guild2'
  ) THEN
    CREATE POLICY "Allow all operations on bid_history_guild2" ON bid_history_guild2
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
