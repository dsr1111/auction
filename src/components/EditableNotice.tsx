"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import Modal from '@/components/Modal';
import NoticeRichText from '@/components/NoticeRichText';
import { parseNoticeContent, sanitizeNoticeDoc, type NoticeDoc } from '@/lib/notice-format';

// 에디터는 관리자가 모달을 열 때만 불러옵니다 (일반 사용자는 다운로드하지 않음).
const NoticeEditor = dynamic(() => import('@/components/NoticeEditor'), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />,
});

type Notice = {
  key: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by_name: string | null;
};

// DB에서 문구를 불러오지 못했을 때 보여줄 기본 문구
const FALLBACK_CONTENT = [
  '**[필독]** 경매 마감 직후 정산 및 아이템 수령을 위해 30분 이내로 접속해 주세요. **미접속으로 인해 아이템 수령을 못할 시 본인 책임입니다.**',
  '',
  '**@ 반드시 인게임 닉네임으로 입찰해 주세요. 장난칠 시 입찰 삭제합니다.**',
  '',
  '**@ 잘못 입찰한 경우 상단 정정 신청 부탁드립니다.**',
  '',
  '**@ 가격이 블라인드된 경매입니다. 마감 직전에 입찰할 필요 없이 여유 있게 입찰해 주세요.**',
].join('\n');

export default function EditableNotice({ noticeKey }: { noticeKey: string }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<NoticeDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notices?key=${encodeURIComponent(noticeKey)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice(json.notice ?? null);
    } catch {
      setNotice(null);
    } finally {
      setLoaded(true);
    }
  }, [noticeKey]);

  useEffect(() => { void load(); }, [load]);

  const doc = useMemo(() => parseNoticeContent(notice?.content ?? FALLBACK_CONTENT), [notice]);
  const savedJson = useMemo(() => JSON.stringify(doc), [doc]);
  const changed = draft !== null && JSON.stringify(draft) !== savedJson;

  const openEditor = () => {
    setDraft(doc);
    setError(null);
    setModalOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    if (changed && !window.confirm('저장하지 않은 변경 내용이 있습니다. 닫을까요?')) return;
    setModalOpen(false);
    setError(null);
  };

  const save = async () => {
    if (!notice || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/notices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: noticeKey, doc: draft, version: notice.version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장하지 못했습니다.');
      setNotice(json.notice);
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`relative bg-red-50 border border-red-200 rounded-xl p-4 ${isAdmin ? 'pr-14' : ''}`}>
        <div className={loaded ? '' : 'opacity-0'}>
          <NoticeRichText doc={doc} />
        </div>
        {isAdmin && loaded && (
          <button
            type="button"
            onClick={openEditor}
            title="안내 문구 수정"
            aria-label="안내 문구 수정"
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
            </svg>
          </button>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={closeEditor} dismissible={!saving} title="안내 문구 수정" size="xl">
        {!notice ? (
          <p className="text-sm text-red-600">
            저장된 안내 문구를 불러오지 못했습니다. site_notices 테이블에 &quot;{noticeKey}&quot; 행이 있는지 확인해주세요.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <NoticeEditor
                initialDoc={doc}
                disabled={saving}
                onChange={(next) => {
                  const clean = sanitizeNoticeDoc(next);
                  setError(clean ? null : '문구가 너무 깁니다. (최대 5,000자)');
                  if (clean) setDraft(clean);
                }}
              />
            </div>

            <p className="text-xs text-gray-400">
              최근 수정: {new Date(notice.updated_at).toLocaleString('ko-KR')}
              {notice.updated_by_name ? ` · ${notice.updated_by_name}` : ''}
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !changed}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
