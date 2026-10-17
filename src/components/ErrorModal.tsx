import React, { useState } from 'react';
import { AlertCircle, X, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
import { FileItem } from '../types';

interface ErrorModalProps {
  file: FileItem;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ file, onClose }) => {
  const [showStacktrace, setShowStacktrace] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const errorText = `Datei: ${file.name}\nPfad: ${file.path}\nFehler: ${file.error}\nLösungshinweis: ${file.solutionHint}\n\nStacktrace:\n${file.errorDetails || 'Kein Stacktrace'}`;
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="markdown-modal-backdrop" onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="var(--color-error)" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Konvertierungsfehler
            </h3>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Betroffene Datei
            </span>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
              {file.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {file.path}
            </div>
          </div>

          <div 
            style={{ 
              padding: '12px', 
              borderRadius: '6px', 
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-error)' }}>
              {file.error || 'Unerwarteter Fehler bei der Verarbeitung'}
            </div>
          </div>

          {file.solutionHint && (
            <div 
              style={{ 
                padding: '12px', 
                borderRadius: '6px', 
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                Lösungsvorschlag
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {file.solutionHint}
              </div>
            </div>
          )}

          {/* Toggleable Stacktrace */}
          {file.errorDetails && (
            <div>
              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ padding: '4px 0', fontSize: '12px' }}
                onClick={() => setShowStacktrace(!showStacktrace)}
              >
                <Terminal size={13} />
                <span>Technische Details (Stacktrace)</span>
                {showStacktrace ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showStacktrace && (
                <div 
                  style={{ 
                    marginTop: '8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    backgroundColor: 'var(--bg-code)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {file.errorDetails}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          style={{ 
            padding: '12px 20px', 
            backgroundColor: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button type="button" className="btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
            {copied ? 'Kopiert' : 'Fehlerbericht kopieren'}
          </button>

          <button type="button" className="btn-primary btn-sm" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
