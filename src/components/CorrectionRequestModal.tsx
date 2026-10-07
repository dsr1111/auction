"use client";

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import { notifyItemUpdate } from '@/utils/pusher';
import { validateCorrectionValues } from '@/lib/correction-validation';

type GuildType = 'guild1' | 'guild2';
type RequestStatus = 'open' | 'resolved';
type ResolutionAction = 'update' | 'delete' | null;

type MyBid = {
  id: number;
  item_id: number;
  item_name: string;
  bid_amount: number;
  bid_quantity: number;
  bidder_nickname: string;
  item_price: number;
  item_quantity: number;
  created_at: string;
  end_time: string | null;
};

type CorrectionRequest = {
  id: number;
  user_id: string;
  requester_name: string;
  guild_type: GuildType;
  category: 'bid_error';
  bid_id: number;
  item_id: number;
  item_name: string;
  bid_amount: number;
  bid_quantity: number;
  bidder_nickname: string | null;
  requested_bid_amount: number | null;
  requested_bid_quantity: number | null;
  requested_bidder_nickname: string | null;
  details: string;
  status: RequestStatus;
  resolution_action: ResolutionAction;
  resolved_bid_amount: number | null;
  resolved_bid_quantity: number | null;
  resolved_bidder_nickname: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type CorrectionRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  defaultGuildType: GuildType;
  onPendingCountChange?: (count: number) => void;
};

const GUILD_LABELS: Record<GuildType, string> = {
  guild1: '세계수 토벌 경매',
  guild2: '크랙 토벌 경매',
};

export default function CorrectionRequestModal({
  isOpen,
  onClose,
  isAdmin,
  defaultGuildType,
  onPendingCountChange,
}: CorrectionRequestModalProps) {
  const [activeView, setActiveView] = useState<'form' | 'requests'>(isAdmin ? 'requests' : 'form');
  const [guildType, setGuildType] = useState<GuildType>(defaultGuildType);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [details, setDetails] = useState('');
  const [requestedBidAmount, setRequestedBidAmount] = useState('');
  const [requestedBidQuantity, setRequestedBidQuantity] = useState('');
  const [requestedBidderNickname, setRequestedBidderNickname] = useState('');
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'open' | 'all'>('open');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [editingBidAmount, setEditingBidAmount] = useState('');
  const [editingBidQuantity, setEditingBidQuantity] = useState('');
  const [editingBidderNickname, setEditingBidderNickname] = useState('');
  const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingRequests(true);
    setRequestError(null);
    try {
      const response = await fetch('/api/correction-requests', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '정정 신청을 불러오지 못했습니다.');
      const nextRequests = data.requests || [];
      setRequests(nextRequests);
      onPendingCountChange?.(nextRequests.filter((requestItem: CorrectionRequest) => requestItem.status === 'open').length);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '정정 신청을 불러오지 못했습니다.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [isAdmin, onPendingCountChange]);

  const fetchMyBids = useCallback(async (targetGuildType: GuildType) => {
    setIsLoadingBids(true);
    setBidError(null);
    setSelectedBidId(null);
    setRequestedBidAmount('');
    setRequestedBidQuantity('');
    setRequestedBidderNickname('');
    try {
      const response = await fetch(`/api/correction-requests/my-bids?guildType=${targetGuildType}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '입찰 목록을 불러오지 못했습니다.');
      setMyBids(data.bids || []);
    } catch (error) {
      setMyBids([]);
      setBidError(error instanceof Error ? error.message : '입찰 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoadingBids(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setGuildType(defaultGuildType);
    setSelectedBidId(null);
    setDetails('');
    setFormMessage(null);
    setActiveView(isAdmin ? 'requests' : 'form');
    if (isAdmin) fetchRequests();
  }, [defaultGuildType, fetchRequests, isAdmin, isOpen]);

  useEffect(() => {
    if (isOpen && activeView === 'form') fetchMyBids(guildType);
  }, [activeView, fetchMyBids, guildType, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBidId) {
      setFormMessage({ type: 'error', text: '정정 신청할 입찰을 선택해주세요.' });
      return;
    }
    if (!details.trim()) {
      setFormMessage({ type: 'error', text: '내용을 입력해주세요.' });
      return;
    }

    const selectedBid = myBids.find((bid) => bid.id === selectedBidId);
    if (!selectedBid) return;
    const requestedAmount = requestedBidAmount === '' ? null : Number(requestedBidAmount);
    const requestedQuantity = requestedBidQuantity === '' ? null : Number(requestedBidQuantity);
    const requestedNickname = requestedBidderNickname === '' ? null : requestedBidderNickname.trim();
    const values = {
      bidAmount: requestedAmount ?? selectedBid.bid_amount,
      bidQuantity: requestedQuantity ?? (selectedBid.bid_quantity || 1),
      bidderNickname: requestedNickname ?? selectedBid.bidder_nickname,
    };
    const validationError = validateCorrectionValues(values);
    if (validationError) {
      setFormMessage({ type: 'error', text: validationError });
      return;
    }
    if (values.bidAmount < Number(selectedBid.item_price) || values.bidQuantity > selectedBid.item_quantity) {
      setFormMessage({ type: 'error', text: `시작가 ${Number(selectedBid.item_price).toLocaleString()} bit 이상, 수량 ${selectedBid.item_quantity}개 이하로 입력해주세요.` });
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);
    try {
      const response = await fetch('/api/correction-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildType, bidId: selectedBidId, details,
          requestedBidAmount: requestedAmount,
          requestedBidQuantity: requestedQuantity,
          requestedBidderNickname: requestedNickname,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '정정 신청을 저장하지 못했습니다.');

      setSelectedBidId(null);
      setDetails('');
      setRequestedBidAmount('');
      setRequestedBidQuantity('');
      setRequestedBidderNickname('');
      setFormMessage({ type: 'success', text: '선택한 입찰의 정정 신청을 접수했습니다.' });
      if (isAdmin) fetchRequests();
    } catch (error) {
      setFormMessage({ type: 'error', text: error instanceof Error ? error.message : '정정 신청을 저장하지 못했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyCorrection = async (requestItem: CorrectionRequest, action: 'update' | 'delete') => {
    const bidAmount = Number(editingBidAmount);
    const bidQuantity = Number(editingBidQuantity);
    // Older requests did not store a nickname; leaving this blank preserves it on the server.
    const bidderNickname = editingBidderNickname === '' && requestItem.bidder_nickname == null
      ? undefined : editingBidderNickname.trim();
    if (action === 'update') {
      const validationError = validateCorrectionValues({ bidAmount, bidQuantity, bidderNickname: bidderNickname ?? '기존 닉네임' });
      if (validationError) {
        setRequestError(validationError);
        return;
      }
    }
    if (action === 'delete' && !confirm(`${requestItem.requester_name}님의 선택한 입찰을 삭제하시겠습니까?`)) return;

    setUpdatingRequestId(requestItem.id);
    setRequestError(null);
    try {
      const response = await fetch(`/api/correction-requests/${requestItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action === 'update' ? { bidAmount, bidQuantity, bidderNickname } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '정정 신청을 처리하지 못했습니다.');

      setRequests((current) => current.map((currentRequest) => (
        currentRequest.id === requestItem.id ? { ...currentRequest, ...data.request } : currentRequest
      )));
      setEditingRequestId(null);
      setEditingBidAmount('');
      setEditingBidQuantity('');
      setEditingBidderNickname('');
      onPendingCountChange?.(Math.max(0, requests.filter((item) => item.status === 'open').length - 1));
      await notifyItemUpdate('bid', data.itemId);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '정정 신청을 처리하지 못했습니다.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const visibleRequests = requests.filter((requestItem) => requestFilter === 'all' || requestItem.status === 'open');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="정정 신청" size={activeView === 'requests' ? 'xl' : 'md'}>
      {isAdmin && (
        <div className="mb-6 grid grid-cols-2 border-b border-gray-200">
          <button type="button" onClick={() => setActiveView('form')} className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeView === 'form' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'}`}>
            신청 작성
          </button>
          <button type="button" onClick={() => setActiveView('requests')} className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeView === 'requests' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'}`}>
            신청 목록
          </button>
        </div>
      )}

      {activeView === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="sr-only">경매 종류</span>
            <select
              value={guildType}
              onChange={(event) => { setGuildType(event.target.value as GuildType); setSelectedBidId(null); setFormMessage(null); }}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="guild1">세계수 토벌 경매</option>
              <option value="guild2">크랙 토벌 경매</option>
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-gray-700">내 입찰 목록</legend>
            <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-2">
              {isLoadingBids ? (
                [0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-gray-200" />)
              ) : bidError ? (
                <div role="alert" className="rounded-xl bg-red-50 px-4 py-5 text-sm text-red-700">{bidError}</div>
              ) : myBids.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  {GUILD_LABELS[guildType]}에서 정정할 수 있는 입찰 내역이 없습니다.
                </div>
              ) : myBids.map((bid) => {
                const isEnded = bid.end_time ? new Date(bid.end_time).getTime() <= Date.now() : false;
                const isSelected = selectedBidId === bid.id;
                return (
                  <label key={bid.id} className={`block cursor-pointer rounded-xl border bg-white p-3 transition-colors ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-transparent hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="correction-bid"
                      value={bid.id}
                      checked={isSelected}
                      disabled={isSubmitting}
                      onChange={() => {
                        setSelectedBidId(bid.id);
                        setRequestedBidAmount('');
                        setRequestedBidQuantity('');
                        setRequestedBidderNickname('');
                        setFormMessage(null);
                      }}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{bid.item_name}</p>
                        <p className="mt-1 text-xs text-gray-600">닉네임: {bid.bidder_nickname}</p>
                        <p className="mt-1 text-xs text-gray-500">{new Date(bid.created_at).toLocaleString('ko-KR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900">{bid.bid_amount.toLocaleString()} bit × {bid.bid_quantity || 1}개</p>
                        <span className={`mt-1 inline-block text-xs font-medium ${isEnded ? 'text-gray-400' : 'text-green-600'}`}>{isEnded ? '마감' : '진행 중'}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedBidId && (
            <fieldset disabled={isSubmitting} className="space-y-3">
              <legend className="text-sm font-medium text-gray-700">변경 요청</legend>
              <p className="text-xs text-gray-500">변경할 항목만 입력해주세요. 입찰 삭제는 내용에 적어주세요.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  가격 (bit)
                  <input type="number" min="10000" max="2000000000" step="10000" value={requestedBidAmount} onChange={(event) => setRequestedBidAmount(event.target.value)} placeholder="변경 없음" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-sm text-gray-700">
                  수량
                  <input type="number" min="1" max={myBids.find((bid) => bid.id === selectedBidId)?.item_quantity} step="1" value={requestedBidQuantity} onChange={(event) => setRequestedBidQuantity(event.target.value)} placeholder="변경 없음" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
                </label>
              </div>
              <label className="block text-sm text-gray-700">
                입찰자 닉네임
                <input type="text" maxLength={100} value={requestedBidderNickname} onChange={(event) => setRequestedBidderNickname(event.target.value)} placeholder="변경 없음" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" />
              </label>
            </fieldset>
          )}

          <label className="block text-sm font-medium text-gray-700">
            내용 <span className="font-normal text-red-500">(필수)</span>
            <textarea
              maxLength={1000}
              required
              rows={4}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="정정 사유나 입찰 삭제 요청 등 필요한 내용을 적어주세요."
              className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <span className="mt-1 block text-right text-xs tabular-nums text-gray-400">{details.length}/1,000</span>
          </label>

          {formMessage && (
            <div role={formMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${formMessage.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {formMessage.text}
            </div>
          )}

          <button type="submit" disabled={isSubmitting || isLoadingBids || !selectedBidId || !details.trim()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSubmitting ? '접수 중...' : '정정 신청'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button type="button" onClick={() => setRequestFilter('open')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${requestFilter === 'open' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                미처리 {requests.filter((item) => item.status === 'open').length}
              </button>
              <button type="button" onClick={() => setRequestFilter('all')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${requestFilter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                전체 {requests.length}
              </button>
            </div>
            <button type="button" onClick={fetchRequests} disabled={isLoadingRequests} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">새로고침</button>
          </div>

          {requestError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{requestError}</div>}

          {isLoadingRequests ? (
            <div className="space-y-3" aria-label="정정 신청을 불러오는 중">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : visibleRequests.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-6 py-12 text-center">
              <p className="font-semibold text-gray-700">표시할 정정 신청이 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">새 신청이 접수되면 이곳에 표시됩니다.</p>
            </div>
          ) : (
            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {visibleRequests.map((requestItem) => (
                <article key={requestItem.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${requestItem.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{requestItem.status === 'open' ? '미처리' : '처리 완료'}</span>
                        <span className="text-sm font-semibold text-gray-900">{requestItem.item_name}</span>
                        <span className="text-xs text-gray-500">{GUILD_LABELS[requestItem.guild_type]}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">신청자 <strong className="font-semibold text-gray-900">{requestItem.requester_name}</strong></p>
                      <time className="mt-1 block text-xs text-gray-400" dateTime={requestItem.created_at}>{new Date(requestItem.created_at).toLocaleString('ko-KR')}</time>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">신청 당시 입찰</p>
                      <p className="mt-1 font-bold tabular-nums text-gray-900">{requestItem.bid_amount.toLocaleString()} bit × {requestItem.bid_quantity || 1}개</p>
                      <p className="mt-1 text-sm text-gray-600">닉네임: {requestItem.bidder_nickname ?? '기록 없음'}</p>
                    </div>
                  </div>

                  {(requestItem.requested_bid_amount != null || requestItem.requested_bid_quantity != null || requestItem.requested_bidder_nickname != null) && (
                    <div className="mt-3 rounded-xl bg-blue-50 px-3 py-3 text-sm text-blue-900">
                      <p className="font-semibold">변경 요청</p>
                      <dl className="mt-2 space-y-1">
                        {requestItem.requested_bid_amount != null && <div><dt className="inline">가격: </dt><dd className="inline">{requestItem.bid_amount.toLocaleString()} → {requestItem.requested_bid_amount.toLocaleString()} bit</dd></div>}
                        {requestItem.requested_bid_quantity != null && <div><dt className="inline">수량: </dt><dd className="inline">{requestItem.bid_quantity || 1} → {requestItem.requested_bid_quantity}개</dd></div>}
                        {requestItem.requested_bidder_nickname != null && <div className="break-words"><dt className="inline">닉네임: </dt><dd className="inline">{requestItem.bidder_nickname ?? '기록 없음'} → {requestItem.requested_bidder_nickname}</dd></div>}
                      </dl>
                    </div>
                  )}
                  {requestItem.details && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700">{requestItem.details}</p>}

                  {requestItem.status === 'open' ? (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
                      {editingRequestId === requestItem.id ? (
                        <>
                          <fieldset disabled={updatingRequestId !== null} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                          <label className="text-xs text-gray-600" htmlFor={`correction-amount-${requestItem.id}`}>
                            가격 (bit)
                          <input
                            id={`correction-amount-${requestItem.id}`}
                            type="number"
                            min="10000"
                            max="2000000000"
                            step="10000"
                            value={editingBidAmount}
                            onChange={(event) => setEditingBidAmount(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
                            autoFocus
                          />
                          </label>
                          <label className="text-xs text-gray-600">
                            수량
                            <input type="number" min="1" step="1" value={editingBidQuantity} onChange={(event) => setEditingBidQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </label>
                          <label className="text-xs text-gray-600">
                            입찰자 닉네임
                            <input type="text" maxLength={100} value={editingBidderNickname} onChange={(event) => setEditingBidderNickname(event.target.value)} placeholder={requestItem.bidder_nickname == null ? '비워두면 기존 닉네임 유지' : ''} className="mt-1 w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </label>
                          </fieldset>
                          <button type="button" disabled={updatingRequestId !== null} onClick={() => applyCorrection(requestItem, 'update')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{updatingRequestId === requestItem.id ? '처리 중...' : '수정 적용'}</button>
                          <button type="button" disabled={updatingRequestId !== null} onClick={() => setEditingRequestId(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">취소</button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={updatingRequestId !== null} onClick={() => {
                            setEditingRequestId(requestItem.id);
                            setEditingBidAmount(String(requestItem.requested_bid_amount ?? requestItem.bid_amount));
                            setEditingBidQuantity(String(requestItem.requested_bid_quantity ?? requestItem.bid_quantity ?? 1));
                            setEditingBidderNickname(requestItem.requested_bidder_nickname ?? requestItem.bidder_nickname ?? '');
                            setRequestError(null);
                          }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">입찰 수정</button>
                          <button type="button" disabled={updatingRequestId !== null} onClick={() => applyCorrection(requestItem, 'delete')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">입찰 삭제</button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-gray-100 pt-3 text-right text-xs font-medium text-gray-500">
                      {requestItem.resolution_action === 'delete'
                        ? '입찰 삭제 처리됨'
                        : `수정 완료: ${(requestItem.resolved_bid_amount || 0).toLocaleString()} bit${requestItem.resolved_bid_quantity != null ? ` × ${requestItem.resolved_bid_quantity}개` : ''}${requestItem.resolved_bidder_nickname != null ? ` · ${requestItem.resolved_bidder_nickname}` : ''}`}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
