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
