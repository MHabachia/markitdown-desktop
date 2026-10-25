import React, { useState } from 'react';

export const TEMPLATE_PRESETS = ['{name}.md', '{date}_{name}.md', '{name}_{date}.md'];

/** Text input that saves on blur or Enter instead of on every keystroke. */
export const TextField: React.FC<{
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}> = ({ value, placeholder, className = 'setting-input', onCommit }) => {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onCommit(trimmed);
  };
  return (
    <input
      type="text"
      className={className}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
};

export const NumberField: React.FC<{ value: number; min: number; max: number; onCommit: (value: number) => void }> = ({
  value,
  min,
  max,
  onCommit
}) => {
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(String(value));
  }
  const commit = () => {
    const parsed = parseInt(draft, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      className="setting-input setting-input-narrow"
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
};

export const Checkbox: React.FC<{ checked: boolean; label: string; onChange: (value: boolean) => void }> = ({ checked, label, onChange }) => (
  <label className="checkbox">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);
