import { useEffect, useRef } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const TOOLBAR_BUTTONS = [
  { cmd: "bold", label: "B", style: "font-bold" },
  { cmd: "italic", label: "I", style: "italic" },
  { cmd: "insertUnorderedList", label: "• Lista", style: "" },
  { cmd: "insertOrderedList", label: "1. Lista", style: "" },
] as const;

const HEADING_OPTIONS = [
  { label: "Párrafo", value: "p" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
  { label: "H4", value: "h4" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe el contenido del módulo...",
  className = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) {
      editorRef.current.innerHTML = value;
      lastValue.current = value;
    }
  }, [value]);

  function execCmd(cmd: string) {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
    handleInput();
  }

  function formatBlock(tag: string) {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
    handleInput();
  }

  function handleInput() {
    const html = editorRef.current?.innerHTML ?? "";
    lastValue.current = html;
    onChange(html);
  }

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-background flex-wrap">
        <select
          onChange={(e) => formatBlock(e.target.value)}
          defaultValue="p"
          className="text-xs border border-border rounded px-1.5 py-1 bg-card"
          onMouseDown={(e) => e.preventDefault()}
        >
          {HEADING_OPTIONS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.cmd}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
            className={`px-2 py-1 text-xs rounded hover:bg-muted/40 transition-colors border border-transparent hover:border-border ${btn.style}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        className="min-h-[160px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none
          [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-muted-foreground
          [&:empty:before]:pointer-events-none"
        dangerouslySetInnerHTML={lastValue.current !== value ? { __html: value } : undefined}
      />
    </div>
  );
}
