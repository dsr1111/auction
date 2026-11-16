export type ListingType = 'sell' | 'buy';

export type TradeListing = {
  id: number;
  listing_type: ListingType;
  digicore: string;
  price: number;
  quantity: number;
  memo: string;
  status: 'active' | 'completed';
  user_id: string;
  user_nickname: string;
  user_discord_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export const TYPE_LABEL: Record<ListingType, string> = { sell: '팝니다', buy: '삽니다' };
export const DONE_LABEL: Record<ListingType, string> = { sell: '판매완료', buy: '구매완료' };
export const ACTIVE_LABEL: Record<ListingType, string> = { sell: '판매중', buy: '구매중' };

export const formatBit = (n: number) => n.toLocaleString('ko-KR');

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
