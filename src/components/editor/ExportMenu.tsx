import React, { useState } from 'react';
import { Copy, Download, FileCode, FileText, Printer, Share2 } from 'lucide-react';

interface ExportMenuProps {
  onSaveMarkdown: () => void;
  onSaveHtml: () => void;
  onSaveText: () => void;
  onPrint: () => void;
  /** Resolves to true when the HTML was copied (the menu then closes). */
  onCopyHtml: () => Promise<boolean>;
}

const ITEM_STYLE = { justifyContent: 'flex-start', width: '100%' } as const;

export const ExportMenu: React.FC<ExportMenuProps> = ({ onSaveMarkdown, onSaveHtml, onSaveText, onPrint, onCopyHtml }) => {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(!open)} title="Export-Optionen">
        <Share2 size={13} />
        Export
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            width: '230px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          <button type="button" className="btn-ghost btn-sm" style={ITEM_STYLE} onClick={run(onSaveMarkdown)}>
            <Download size={13} /> Als Markdown speichern …
          </button>
          <button type="button" className="btn-ghost btn-sm" style={ITEM_STYLE} onClick={run(onSaveHtml)}>
            <FileCode size={13} /> Als HTML speichern …
          </button>
          <button type="button" className="btn-ghost btn-sm" style={ITEM_STYLE} onClick={run(onSaveText)}>
            <FileText size={13} /> Als Text speichern …
          </button>
          <button type="button" className="btn-ghost btn-sm" style={ITEM_STYLE} onClick={run(onPrint)}>
            <Printer size={13} /> Als PDF drucken / speichern
          </button>
          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
          <button
            type="button"
            className="btn-ghost btn-sm"
            style={ITEM_STYLE}
            onClick={async () => {
              if (await onCopyHtml()) setOpen(false);
            }}
          >
            <Copy size={13} /> HTML in Zwischenablage
          </button>
        </div>
      )}
    </div>
  );
};
