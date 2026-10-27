import React from 'react';
import { DocumentStats } from '../../utils/editor';
import { shortcut } from '../../utils/platform';

export const EditorFooter: React.FC<{ stats: DocumentStats }> = ({ stats }) => (
  <div className="editor-footer">
    <div className="editor-stats-bar">
      <span>{stats.words.toLocaleString()} Wörter</span>
      <span>•</span>
      <span>{stats.chars.toLocaleString()} Zeichen</span>
      <span>•</span>
      <span>{stats.lines} Zeilen</span>
      <span>•</span>
      <span>ca. {stats.readTimeMinutes} Min. Lesezeit</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{`${shortcut('S')} Speichern · ${shortcut('F')} Suchen`}</span>
    </div>
  </div>
);
