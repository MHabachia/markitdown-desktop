import React, { useState } from 'react';
import { UploadCloud, FolderPlus, FilePlus, Sparkles } from 'lucide-react';
import { FormatCapability } from '../types';
import { FormatStrip } from './FormatStrip';
import { Stepper } from './Stepper';

interface DropZoneProps {
  capabilities: FormatCapability[];
  /** Native drag in progress (desktop app); the browser build tracks HTML5 drags itself. */
  isDragging: boolean;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onLoadSamples: () => void;
  /** Browser fallback: files dropped via HTML5 drag & drop. */
  onBrowserDrop: (files: File[]) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  capabilities,
  isDragging,
  onPickFiles,
  onPickFolder,
  onLoadSamples,
  onBrowserDrop
}) => {
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);
  const highlighted = isDragging || isHtmlDragOver;

  return (
    <div className="dropzone-container">
      <Stepper
        steps={[
          { label: 'Dateien wählen', state: 'active' },
          { label: 'Umwandeln', state: 'todo' },
          { label: 'Prüfen und speichern', state: 'todo' }
        ]}
      />

      <div
        className={`dropzone-hero ${highlighted ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsHtmlDragOver(true);
        }}
        onDragLeave={() => setIsHtmlDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsHtmlDragOver(false);
          if (e.dataTransfer.files.length > 0) onBrowserDrop(Array.from(e.dataTransfer.files));
        }}
        onClick={onPickFiles}
      >
        <div className="dropzone-icon-circle">
          <UploadCloud size={32} aria-hidden="true" />
        </div>

        <h2 className="dropzone-title">{highlighted ? 'Loslassen zum Hinzufügen' : 'Dateien in Markdown umwandeln'}</h2>
        <p className="dropzone-subtitle">
          Zieh Dokumente oder Ordner hierher oder wähle sie aus. Du bekommst sauberes Markdown für Notizen, Wikis und KI-Tools.
        </p>

        <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-primary btn-lg" onClick={onPickFiles}>
            <FilePlus size={16} aria-hidden="true" />
            Dateien auswählen
          </button>
          <button type="button" className="btn-secondary btn-lg" onClick={onPickFolder}>
            <FolderPlus size={16} aria-hidden="true" />
            Ganzen Ordner
          </button>
          <button
            type="button"
            className="btn-ghost btn-lg"
            onClick={onLoadSamples}
            title="Beispieldokumente (PDF, Word, Excel, PowerPoint, CSV) zum Ausprobieren"
          >
            <Sparkles size={16} aria-hidden="true" />
            Mit Beispielen ausprobieren
          </button>
        </div>
      </div>

      <FormatStrip capabilities={capabilities} />
      <p className="dropzone-note">Alles läuft lokal auf diesem Gerät. Nichts wird hochgeladen.</p>
    </div>
  );
};
