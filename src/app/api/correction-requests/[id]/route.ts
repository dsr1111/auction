import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCorrectionValues } from '@/lib/correction-validation';

type GuildType = 'guild1' | 'guild2';
type RouteContext = {
  params: Promise<{ id: string }>;
};

function getTables(guildType: GuildType) {
  return guildType === 'guild2'
    ? { itemsTable: 'items_guild2', historyTable: 'bid_history_guild2' }
    : { itemsTable: 'items', historyTable: 'bid_history' };
}

async function syncItemHighestBid(
  supabase: ReturnType<typeof createAdminClient>,
  guildType: GuildType,
  itemId: number,
) {
  const { itemsTable, historyTable } = getTables(guildType);
  const { data: highestBid, error: highestBidError } = await supabase
    .from(historyTable)
    .select('bid_amount, bidder_nickname')
    .eq('item_id', itemId)
    .order('bid_amount', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (highestBidError) throw highestBidError;

  let currentBid = highestBid?.bid_amount;
  let lastBidderNickname = highestBid?.bidder_nickname ?? null;

  if (!highestBid) {
    const { data: item, error: itemError } = await supabase
      .from(itemsTable)
      .select('price')
      .eq('id', itemId)
      .single();
    if (itemError) throw itemError;
    currentBid = item.price;
    lastBidderNickname = null;
  }

  const { error: updateItemError } = await supabase
    .from(itemsTable)
    .update({ current_bid: currentBid, last_bidder_nickname: lastBidderNickname })
    .eq('id', itemId);
  if (updateItemError) throw updateItemError;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
    if (!user?.id || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idValue } = await context.params;
    const requestId = Number(idValue);
    const body = await request.json();
    const action = body.action;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }
    if (action !== 'update' && action !== 'delete') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const bidAmount = Number(body.bidAmount);
    if (action === 'update' && (
      !Number.isInteger(bidAmount) ||
      bidAmount <= 0 ||
      bidAmount > 2_000_000_000 ||
      bidAmount % 10_000 !== 0
    )) {
      return NextResponse.json({ error: '입찰 가격은 10,000bit 단위의 20억 이하 정수여야 합니다.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: correctionRequest, error: requestError } = await supabase
      .from('correction_requests')
      .select('id, user_id, status, guild_type, bid_id, item_id')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!correctionRequest) {
      return NextResponse.json({ error: '정정 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (correctionRequest.status !== 'open') {
      return NextResponse.json({ error: '이미 처리된 정정 신청입니다.' }, { status: 409 });
    }
    if (!correctionRequest.bid_id || !correctionRequest.item_id ||
      (correctionRequest.guild_type !== 'guild1' && correctionRequest.guild_type !== 'guild2')) {
      return NextResponse.json({ error: '연결된 입찰 정보가 올바르지 않습니다.' }, { status: 409 });
    }

    const guildType = correctionRequest.guild_type as GuildType;
    const { itemsTable, historyTable } = getTables(guildType);
    const { data: currentBid, error: bidError } = await supabase
      .from(historyTable)
      .select('id, item_id, bid_amount, bid_quantity, bidder_nickname, bidder_discord_id')
      .eq('id', correctionRequest.bid_id)
      .eq('item_id', correctionRequest.item_id)
      .maybeSingle();

    if (bidError) throw bidError;
    if (!currentBid) {
      return NextResponse.json({ error: '해당 입찰이 이미 삭제되었거나 존재하지 않습니다.' }, { status: 404 });
    }
    if (currentBid.bidder_discord_id !== correctionRequest.user_id) {
      return NextResponse.json({ error: '신청자와 연결된 입찰자가 일치하지 않습니다.' }, { status: 409 });
    }

    const bidQuantity = body.bidQuantity === undefined ? (currentBid.bid_quantity || 1) : Number(body.bidQuantity);
    const bidderNickname = body.bidderNickname === undefined ? currentBid.bidder_nickname :
      (typeof body.bidderNickname === 'string' ? body.bidderNickname.trim() : '');

    if (action === 'update') {
      const validationError = validateCorrectionValues({ bidAmount, bidQuantity, bidderNickname });
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      const { data: item, error: itemError } = await supabase
        .from(itemsTable)
        .select('price, quantity')
        .eq('id', correctionRequest.item_id)
        .maybeSingle();
      if (itemError) throw itemError;
      if (!item) {
        return NextResponse.json({ error: '경매 품목을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (bidAmount < item.price) {
        return NextResponse.json({ error: '입찰 가격은 시작가 이상이어야 합니다.' }, { status: 400 });
      }
      if (bidQuantity > (item.quantity || 1)) {
        return NextResponse.json({ error: `입찰 수량은 ${item.quantity || 1}개를 초과할 수 없습니다.` }, { status: 400 });
      }

      const { error: updateBidError } = await supabase
        .from(historyTable)
        .update({ bid_amount: bidAmount, bid_quantity: bidQuantity, bidder_nickname: bidderNickname })
        .eq('id', currentBid.id);
      if (updateBidError) throw updateBidError;
    } else {
      const { error: deleteBidError } = await supabase
        .from(historyTable)
        .delete()
        .eq('id', currentBid.id);
      if (deleteBidError) throw deleteBidError;
    }

    await syncItemHighestBid(supabase, guildType, correctionRequest.item_id);

    const now = new Date().toISOString();
    const { data: resolvedRequest, error: resolveError } = await supabase
      .from('correction_requests')
      .update({
        status: 'resolved',
        resolution_action: action,
        resolved_bid_amount: action === 'update' ? bidAmount : currentBid.bid_amount,
        resolved_bid_quantity: action === 'update' ? bidQuantity : (currentBid.bid_quantity || 1),
        resolved_bidder_nickname: action === 'update' ? bidderNickname : currentBid.bidder_nickname,
        resolved_at: now,
        resolved_by: user.id,
        updated_at: now,
      })
      .eq('id', requestId)
      .select('id, status, resolution_action, resolved_bid_amount, resolved_bid_quantity, resolved_bidder_nickname, resolved_at, resolved_by, updated_at')
      .single();

    if (resolveError) throw resolveError;

    return NextResponse.json({
      success: true,
      request: resolvedRequest,
      itemId: correctionRequest.item_id,
    });
  } catch (error) {
    console.error('Correction request PATCH error:', error);
    return NextResponse.json({ error: '정정 신청을 처리하지 못했습니다.' }, { status: 500 });
  }
}
