import React, { useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/** App icon (same artwork as app-icon.svg, without the macOS safe-area margin). */
export const Logo: React.FC<LogoProps> = ({ size = 32, className = '' }) => {
  // Unique gradient ids: several logos on one page must not share <defs>.
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="100 100 824 824"
      className={className}
      role="img"
      aria-label="MarkItDown"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#4B2BD6" />
        </linearGradient>
        <linearGradient id={`${id}page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEEAFF" />
        </linearGradient>
      </defs>
      <rect x="100" y="100" width="824" height="824" rx="186" fill={`url(#${id}bg)`} />
      <path
        d="M330 222 H590 L716 348 V770 a32 32 0 0 1 -32 32 H330 a32 32 0 0 1 -32 -32 V254 a32 32 0 0 1 32 -32 Z"
        fill={`url(#${id}page)`}
      />
      <path d="M590 222 V316 a32 32 0 0 0 32 32 H716 Z" fill="#C9BEFF" />
      <g fill="#5A3AE6">
        <rect x="410" y="420" width="44" height="300" rx="22" transform="rotate(10 432 570)" />
        <rect x="528" y="420" width="44" height="300" rx="22" transform="rotate(10 550 570)" />
        <rect x="368" y="496" width="248" height="44" rx="22" />
        <rect x="352" y="600" width="248" height="44" rx="22" />
      </g>
    </svg>
  );
};
