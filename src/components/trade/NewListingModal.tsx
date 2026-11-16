"use client";

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { DIGICORES, digicoreSearchKey, digicoreShortName } from '@/lib/digicores';
import DigicoreIcon from './DigicoreIcon';
import { formatBit, TYPE_LABEL, type ListingType, type TradeListing } from './types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialType: ListingType;
  initialDigicore: string | null;
  nickname: string;
  onCreated: (listing: TradeListing) => void;
};

export default function NewListingModal({ isOpen, onClose, initialType, initialDigicore, nickname, onCreated }: Props) {
  const [type, setType] = useState<ListingType>(initialType);
  const [digicore, setDigicore] = useState<string | null>(initialDigicore);
  const [query, setQuery] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setType(initialType);
    setDigicore(initialDigicore);
    setQuery('');
    setPrice('');
    setQuantity('1');
    setMemo('');
    setError(null);
  }, [isOpen, initialType, initialDigicore]);

  const matches = useMemo(() => {
    const q = query.replace(/[\s_:\-()]/g, '').toLowerCase();
    return q ? DIGICORES.filter((d) => digicoreSearchKey(d).includes(q)) : DIGICORES;
  }, [query]);

  const priceNum = Number(price.replace(/[^0-9]/g, ''));
  const qtyNum = Number(quantity.replace(/[^0-9]/g, ''));

  const submit = async () => {
    setError(null);
    if (!digicore) return setError('거래할 디지코어를 골라주세요.');
    if (!priceNum || priceNum > 2_000_000_000) return setError('가격을 1 ~ 20억 사이로 입력해주세요.');
    if (!qtyNum || qtyNum > 999) return setError('수량을 1 ~ 999개로 입력해주세요.');
    setSaving(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingType: type, digicore, price: priceNum, quantity: qtyNum, memo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '등록하지 못했습니다.');
      onCreated(json.listing);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} dismissible={!saving} title="거래글 등록" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="거래 종류">
          {(['sell', 'buy'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`h-10 rounded-lg text-sm font-bold transition-colors ${type === t ? (t === 'sell' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white') : 'text-gray-600 hover:text-gray-900'}`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">디지코어</p>
          {digicore ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <DigicoreIcon name={digicore} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{digicoreShortName(digicore)}</p>
                <p className="truncate text-xs text-gray-500">{digicore}</p>
              </div>
              <button type="button" onClick={() => setDigicore(null)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200">변경</button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="디지몬 이름 검색 (예: 듀크몬)" className="w-full rounded-t-xl border-b border-gray-200 px-3 py-2.5 text-sm focus:outline-none" autoFocus />
              <ul className="max-h-56 overflow-y-auto p-1">
                {matches.map((d) => (
                  <li key={d}>
                    <button type="button" onClick={() => setDigicore(d)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100">
                      <DigicoreIcon name={d} size={28} />
                      {digicoreShortName(d)}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">검색 결과가 없습니다.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block text-sm font-medium text-gray-700">
            개당 가격 (bit)
            <input
              inputMode="numeric"
              value={price ? formatBit(priceNum) : ''}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="예: 1,500,000"
              className={`${field} mt-2 text-right tabular-nums`}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            수량
            <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} className={`${field} mt-2 text-right tabular-nums`} />
          </label>
        </div>
        {priceNum > 0 && qtyNum > 1 && (
          <p className="-mt-3 text-right text-xs text-gray-500">총 {formatBit(priceNum * qtyNum)} bit</p>
        )}

        <label className="block text-sm font-medium text-gray-700">
          메모 <span className="font-normal text-gray-400">(선택)</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 200))} placeholder="예: 저녁 9시 이후 접속, 흥정 가능" className={`${field} mt-2`} />
        </label>

        <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-800">{nickname || '내 닉네임'}</span> 이름으로 등록됩니다. 관심 있는 사람이 디스코드 DM으로 연락할 수 있어요.
        </p>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">취소</button>
          <button type="button" onClick={submit} disabled={saving} className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${type === 'sell' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? '등록 중...' : `${TYPE_LABEL[type]} 등록`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
