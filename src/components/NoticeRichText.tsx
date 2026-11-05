import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { NoticeDoc, NoticeTextNode } from '@/lib/notice-format';

// 검증된 문서를 React 요소로 그립니다. HTML 문자열을 직접 넣지 않으므로 스크립트가 들어갈 수 없습니다.
function renderText(node: NoticeTextNode, key: number) {
  let el: ReactNode = node.text;
  const style: CSSProperties & { '--notice-color'?: string } = {};
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') el = <strong className="font-bold">{el}</strong>;
    else if (mark.type === 'italic') el = <em>{el}</em>;
    else if (mark.type === 'underline') el = <u>{el}</u>;
    else if (mark.type === 'strike') el = <s>{el}</s>;
    else if (mark.type === 'textStyle') {
      // 색은 CSS 변수로 넘겨서 다크모드에서 밝게 보정할 수 있게 합니다 (globals.css .notice-color)
      if (mark.attrs.color) style['--notice-color'] = mark.attrs.color;
      if (mark.attrs.fontSize) style.fontSize = mark.attrs.fontSize;
    }
  }
  const color = style['--notice-color'];
  return color || style.fontSize
    ? <span key={key} className={color ? 'notice-color' : undefined} style={style}>{el}</span>
    : <Fragment key={key}>{el}</Fragment>;
}

export default function NoticeRichText({ doc }: { doc: NoticeDoc }) {
  return (
    <div className="notice-rich text-sm text-red-800 font-medium break-words">
      {doc.content.map((p, i) => (
        <p key={i}>
          {p.content?.map((node, j) =>
            node.type === 'hardBreak' ? <br key={j} /> : renderText(node, j)
          )}
        </p>
      ))}
    </div>
  );
}
