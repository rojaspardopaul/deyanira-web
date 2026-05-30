'use client';

import { useEffect, useState } from 'react';

interface ScissorsLoaderProps {
  fullScreen?: boolean;
  size?: number;
}

export default function ScissorsLoader({ fullScreen = true, size = 48 }: ScissorsLoaderProps) {
  const [snip, setSnip] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setSnip((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  const scissors = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Cargando"
      style={{
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        transform: snip ? 'rotate(-15deg) scale(1.08)' : 'rotate(0deg) scale(1)',
        filter: 'drop-shadow(0 4px 12px rgba(219,39,119,0.35))',
      }}
    >
      {/* Upper blade */}
      <g
        style={{
          transform: snip ? 'rotate(-18deg)' : 'rotate(0deg)',
          transformOrigin: '9px 12px',
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <circle cx="6" cy="8" r="2.5" fill="url(#sc-grad)" />
        <path
          d="M8 8.5 L20 11"
          stroke="url(#sc-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {/* Lower blade */}
      <g
        style={{
          transform: snip ? 'rotate(18deg)' : 'rotate(0deg)',
          transformOrigin: '9px 12px',
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <circle cx="6" cy="16" r="2.5" fill="url(#sc-grad)" />
        <path
          d="M8 15.5 L20 13"
          stroke="url(#sc-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {/* Pivot screw */}
      <circle cx="9" cy="12" r="1.2" fill="#e6368a" />
      <defs>
        <linearGradient id="sc-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4FA2" />
          <stop offset="100%" stopColor="#c2185b" />
        </linearGradient>
      </defs>
    </svg>
  );

  if (!fullScreen) return scissors;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(6px)' }}
      aria-live="polite"
      aria-label="Cargando"
    >
      <div className="flex flex-col items-center gap-3">
        {scissors}
        <span
          className="text-sm font-medium text-primary-600 tracking-wide"
          style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
        >
          Cargando…
        </span>
      </div>
    </div>
  );
}
