import React from 'react';
import { FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, LucideIcon, Presentation } from 'lucide-react';

type Kind = 'pdf' | 'word' | 'sheet' | 'slides' | 'code' | 'image' | 'other';

const KIND_BY_EXT: Record<string, Kind> = {
  '.pdf': 'pdf',
  '.docx': 'word',
  '.xlsx': 'sheet',
  '.xls': 'sheet',
  '.csv': 'sheet',
  '.tsv': 'sheet',
  '.pptx': 'slides',
  '.html': 'code',
  '.htm': 'code',
  '.xhtml': 'code',
  '.json': 'code',
  '.xml': 'code',
  '.ipynb': 'code',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image'
};

const ICON_BY_KIND: Record<Kind, LucideIcon> = {
  pdf: FileText,
  word: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  code: FileCode,
  image: FileImage,
  other: FileText
};

export const fileKind = (extension: string): Kind =>
  extension.toLowerCase() === '.zip' ? 'other' : KIND_BY_EXT[extension.toLowerCase()] ?? 'other';

/** Document icon tinted by file type (PDF red, Word blue, sheets green, …). */
export const FileIcon: React.FC<{ extension: string; size?: number }> = ({ extension, size = 20 }) => {
  const kind = fileKind(extension);
  const Icon = extension.toLowerCase() === '.zip' ? FileArchive : ICON_BY_KIND[kind];
  return <Icon size={size} className={`file-icon type-${kind}`} aria-hidden="true" />;
};
