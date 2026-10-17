import React from 'react';
import { FormatCapability } from '../types';
import { DEFAULT_CAPABILITIES } from '../api/client';
import { FileIcon } from './FileIcon';

const SAMPLE_EXT: Record<string, string> = {
  pdf: '.pdf', docx: '.docx', pptx: '.pptx', xlsx: '.xlsx', html: '.html', csv: '.csv',
  json: '.json', text: '.txt', ipynb: '.ipynb', image: '.png', zip: '.zip'
};

const SHORT_NAMES: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
  xlsx: 'Excel',
  html: 'HTML',
  csv: 'CSV',
  json: 'JSON/XML',
  text: 'Text',
  ipynb: 'Notebooks',
  image: 'Bilder',
  zip: 'ZIP'
};

/** Supported formats as small pills with coloured file icons. */
export const FormatStrip: React.FC<{ capabilities: FormatCapability[] }> = ({ capabilities }) => {
  const shown = capabilities.length > 0 ? capabilities : DEFAULT_CAPABILITIES;
  return (
    <div className="format-strip" title={shown.flatMap((cap) => cap.extensions).join(' ')}>
      {shown
        .filter((cap) => cap.status === 'ready')
        .map((cap) => (
          <span key={cap.id} className="format-pill">
            <FileIcon extension={SAMPLE_EXT[cap.id] ?? '.txt'} size={14} />
            {SHORT_NAMES[cap.id] || cap.name}
          </span>
        ))}
    </div>
  );
};
