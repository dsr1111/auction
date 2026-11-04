// 안내 문구 서식 데이터(Tiptap JSON) 정의와 검증.
// 서버 저장 시와 화면 렌더링 시 모두 이 함수로 허용된 노드/서식만 남깁니다.

export type NoticeMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' }
  | { type: 'textStyle'; attrs: { color?: string; fontSize?: string } };

export type NoticeTextNode = { type: 'text'; text: string; marks?: NoticeMark[] };
export type NoticeInline = NoticeTextNode | { type: 'hardBreak' };
export type NoticeParagraph = { type: 'paragraph'; content?: NoticeInline[] };
export type NoticeDoc = { type: 'doc'; content: NoticeParagraph[] };

export const NOTICE_FONT_SIZES = [
  { value: '12px', label: '아주 작게' },
  { value: '14px', label: '보통' },
  { value: '16px', label: '조금 크게' },
  { value: '18px', label: '크게' },
  { value: '22px', label: '아주 크게' },
] as const;

export const NOTICE_COLORS = [
  { value: '#991b1b', label: '기본 빨강' },
  { value: '#dc2626', label: '빨강' },
  { value: '#ea580c', label: '주황' },
  { value: '#ca8a04', label: '노랑' },
  { value: '#16a34a', label: '초록' },
  { value: '#2563eb', label: '파랑' },
  { value: '#7c3aed', label: '보라' },
  { value: '#4b5563', label: '회색' },
  { value: '#111827', label: '검정' },
] as const;

const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike']);
const FONT_SIZES = new Set<string>(NOTICE_FONT_SIZES.map((s) => s.value));
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_PARAGRAPHS = 200;
const MAX_TEXT = 5000;

type Unknown = Record<string, unknown>;
const isObj = (v: unknown): v is Unknown => typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitizeMarks(marks: unknown): NoticeMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: NoticeMark[] = [];
  for (const m of marks) {
    if (!isObj(m) || typeof m.type !== 'string') continue;
    if (SIMPLE_MARKS.has(m.type)) {
      out.push({ type: m.type as 'bold' });
    } else if (m.type === 'textStyle' && isObj(m.attrs)) {
      const attrs: { color?: string; fontSize?: string } = {};
      if (typeof m.attrs.color === 'string' && HEX_COLOR.test(m.attrs.color)) attrs.color = m.attrs.color.toLowerCase();
      if (typeof m.attrs.fontSize === 'string' && FONT_SIZES.has(m.attrs.fontSize)) attrs.fontSize = m.attrs.fontSize;
      if (attrs.color || attrs.fontSize) out.push({ type: 'textStyle', attrs });
    }
  }
  return out.length ? out : undefined;
}

/** 허용되지 않은 노드/서식을 제거한 문서를 돌려줍니다. 형식이 아예 틀리면 null. */
export function sanitizeNoticeDoc(input: unknown): NoticeDoc | null {
  if (!isObj(input) || input.type !== 'doc' || !Array.isArray(input.content)) return null;
  let textLength = 0;
  const paragraphs: NoticeParagraph[] = [];
  for (const block of input.content.slice(0, MAX_PARAGRAPHS)) {
    if (!isObj(block) || block.type !== 'paragraph') continue;
    const inline: NoticeInline[] = [];
    if (Array.isArray(block.content)) {
      for (const node of block.content) {
        if (!isObj(node)) continue;
        if (node.type === 'hardBreak') {
          inline.push({ type: 'hardBreak' });
        } else if (node.type === 'text' && typeof node.text === 'string' && node.text.length > 0) {
          textLength += node.text.length;
          if (textLength > MAX_TEXT) return null;
          const marks = sanitizeMarks(node.marks);
          inline.push(marks ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text });
        }
      }
    }
    paragraphs.push(inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' });
  }
  return { type: 'doc', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] };
}

/** 예전 텍스트 형식(**굵게**, 줄바꿈)을 문서로 변환합니다. */
function legacyTextToDoc(text: string): NoticeDoc {
  return {
    type: 'doc',
    content: text.split('\n').map((line) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      const content: NoticeInline[] = parts.map((part) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4
          ? { type: 'text', text: part.slice(2, -2), marks: [{ type: 'bold' }] }
          : { type: 'text', text: part }
      );
      return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
    }),
  };
}

/** DB에 저장된 content 문자열을 안전한 문서로 변환합니다. */
export function parseNoticeContent(content: string): NoticeDoc {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const doc = sanitizeNoticeDoc(JSON.parse(trimmed));
      if (doc) return doc;
    } catch {
      // 아래 텍스트 처리로 넘어감
    }
  }
  return legacyTextToDoc(content);
}
