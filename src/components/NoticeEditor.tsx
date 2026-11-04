"use client";

import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { NOTICE_COLORS, NOTICE_FONT_SIZES, type NoticeDoc } from '@/lib/notice-format';

type Props = {
  initialDoc: NoticeDoc;
  onChange: (doc: unknown) => void;
  disabled?: boolean;
};

const btn = 'h-8 min-w-8 px-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40';
const active = 'bg-gray-200 text-gray-900';

export default function NoticeEditor({ initialDoc, onChange, disabled }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
        trailingNode: false,
      }),
      TextStyle,
      Color,
      FontSize,
    ],
    content: initialDoc,
    editorProps: {
      attributes: {
        class: 'notice-rich text-sm text-red-800 font-medium break-words min-h-[180px] outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) => editor ? {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      color: (editor.getAttributes('textStyle').color as string | undefined) ?? '',
      fontSize: (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '',
    } : null,
  });

  if (!editor) {
    return <div data-editor-loading="1" className="h-[260px] rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />;
  }
  const s = state ?? { bold: false, italic: false, underline: false, strike: false, color: '', fontSize: '' };

  const chain = () => editor.chain().focus();

  return (
    <div className="rounded-xl border border-gray-300 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button type="button" title="굵게 (Ctrl+B)" disabled={disabled} onClick={() => chain().toggleBold().run()} className={`${btn} font-bold ${s.bold ? active : ''}`}>B</button>
        <button type="button" title="기울임 (Ctrl+I)" disabled={disabled} onClick={() => chain().toggleItalic().run()} className={`${btn} italic ${s.italic ? active : ''}`}>I</button>
        <button type="button" title="밑줄 (Ctrl+U)" disabled={disabled} onClick={() => chain().toggleUnderline().run()} className={`${btn} underline ${s.underline ? active : ''}`}>U</button>
        <button type="button" title="취소선" disabled={disabled} onClick={() => chain().toggleStrike().run()} className={`${btn} line-through ${s.strike ? active : ''}`}>S</button>

        <span className="mx-1 h-5 w-px bg-gray-300" />

        <select
          title="글씨 크기"
          disabled={disabled}
          value={s.fontSize || '14px'}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '14px') chain().unsetFontSize().run();
            else chain().setFontSize(v).run();
          }}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
        >
          {NOTICE_FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <span className="mx-1 h-5 w-px bg-gray-300" />

        <div className="flex items-center gap-1" role="group" aria-label="글씨 색">
          {NOTICE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              aria-label={`글씨 색: ${c.label}`}
              disabled={disabled}
              onClick={() => (c.value === '#991b1b' ? chain().unsetColor().run() : chain().setColor(c.value).run())}
              className={`h-6 w-6 rounded-full border-2 ${(s.color || '#991b1b').toLowerCase() === c.value ? 'border-gray-900' : 'border-white ring-1 ring-gray-300'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <label title="직접 고르기" className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-gray-300" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
            <input
              type="color"
              disabled={disabled}
              value={s.color || '#991b1b'}
              onChange={(e) => chain().setColor(e.target.value).run()}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-300" />

        <button type="button" title="선택한 글자의 서식 지우기" disabled={disabled} onClick={() => chain().unsetAllMarks().run()} className={btn}>서식 지우기</button>
      </div>

      <div className="bg-red-50 p-4 cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
