"use client";

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { digicoreShortName } from '@/lib/digicores';
import DigicoreIcon from './DigicoreIcon';
import { DONE_LABEL, formatBit, TYPE_LABEL, type TradeListing } from './types';

type Props = {
  listing: TradeListing | null;
  onClose: () => void;
  onSaved: (listing: TradeListing, completed: TradeListing | null) => void;
};

export default function EditListingModal({ listing, onClose, onSaved }: Props) {
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [memo, setMemo] = useState('');
  const [recordDone, setRecordDone] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listing) return;
    setPrice(String(listing.price));
    setQuantity(String(listing.quantity));
    setMemo(listing.memo ?? '');
    setRecordDone(true);
    setError(null);
  }, [listing]);

  if (!listing) return null;

  const priceNum = Number(price.replace(/[^0-9]/g, ''));
  const qtyNum = Number(quantity.replace(/[^0-9]/g, ''));
  const doneQty = qtyNum > 0 ? listing.quantity - qtyNum : 0;
  const doneLabel = DONE_LABEL[listing.listing_type];

  const submit = async () => {
    setError(null);
    if (!priceNum || priceNum > 2_000_000_000) return setError('가격을 1 ~ 20억 사이로 입력해주세요.');
    if (!qtyNum || qtyNum > 999) return setError(`남은 수량을 1 ~ 999개로 입력해주세요. 전부 거래했다면 상태를 ${doneLabel}로 바꿔주세요.`);
    setSaving(true);
    try {
      const res = await fetch(`/api/trade/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', price: priceNum, quantity: qtyNum, memo, recordDone: doneQty > 0 && recordDone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '수정하지 못했습니다.');
      onSaved(json.listing, json.completed ?? null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal isOpen onClose={() => !saving && onClose()} dismissible={!saving} title="거래글 수정" size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <DigicoreIcon name={listing.digicore} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{digicoreShortName(listing.digicore)}</p>
            <p className="truncate text-xs text-gray-500">{listing.digicore}</p>
          </div>
          <span className={`rounded-md px-2 py-1 text-xs font-bold ${listing.listing_type === 'sell' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{TYPE_LABEL[listing.listing_type]}</span>
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block text-sm font-medium text-gray-700">
            개당 가격 (bit)
            <input
              inputMode="numeric"
              value={price ? formatBit(priceNum) : ''}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              className={`${field} mt-2 text-right tabular-nums`}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            남은 수량
            <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} className={`${field} mt-2 text-right tabular-nums`} />
          </label>
        </div>

        {doneQty > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <input type="checkbox" checked={recordDone} onChange={(e) => setRecordDone(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-emerald-600" />
            <span className="text-sm text-gray-800">
              줄어든 <b className="text-emerald-700">{doneQty}개</b>를 {doneLabel} 처리할까요?
              <span className="mt-1.5 block space-y-0.5 text-xs leading-relaxed text-gray-500">
                <span className="block">체크하면 {formatBit(listing.price)} bit × {doneQty}개가 {doneLabel} 글로 따로 남고,</span>
                <span className="block">이 글은 {qtyNum}개로 계속 {listing.listing_type === 'sell' ? '판매' : '구매'}됩니다.</span>
                <span className="block pt-1 text-gray-400">단순히 수량을 잘못 적은 거라면 체크를 해제하세요.</span>
              </span>
            </span>
          </label>
        )}

        <label className="block text-sm font-medium text-gray-700">
          메모 <span className="font-normal text-gray-400">(선택)</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 200))} className={`${field} mt-2`} />
        </label>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">취소</button>
          <button type="button" onClick={submit} disabled={saving} className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
