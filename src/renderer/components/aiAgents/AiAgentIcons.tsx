import React from 'react';
import { AiAgentId } from '../../../shared/aiAgents';

export function ClaudeIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#CC785C" />
      <path
        d="M17.8 8.5H14.2L8.5 23.5H12.2L13.5 20H18.5L19.8 23.5H23.5L17.8 8.5ZM14.6 17L16 12.8L17.4 17H14.6Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function CodexIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#10A37F" />
      <path
        d="M23.5 13.8C23.1 11.5 21.2 9.8 19 9.8C18.6 9.8 18.2 9.9 17.8 10.1C17.1 8.5 15.4 7.5 13.5 7.5C11.1 7.5 9.1 9.3 8.8 11.7C8.4 11.9 8 12.2 7.7 12.6C6.8 13.7 6.5 15.2 6.9 16.6C6.5 17.5 6.5 18.5 6.9 19.4C7.5 20.9 8.9 22 10.5 22.2C10.8 22.7 11.2 23.1 11.7 23.4C13 24.2 14.6 24.3 16 23.6C16.6 24.2 17.4 24.5 18.2 24.5C20.4 24.5 22.3 22.9 22.8 20.8C23.5 20.3 24 19.5 24.2 18.6C24.6 17 24.3 15.3 23.5 13.8Z"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CursorAgentIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#18181B" />
      <path
        d="M9 23L17 6L19 15.5L23.5 18L9 23Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AntigravityIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="url(#agyGrad)" />
      <path
        d="M16 7L24 21H8L16 7Z"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17" r="2.5" fill="#FFFFFF" />
      <defs>
        <linearGradient id="agyGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function getAiAgentIcon(id: AiAgentId, size = 30) {
  switch (id) {
    case 'claude':
      return <ClaudeIcon size={size} />;
    case 'codex':
      return <CodexIcon size={size} />;
    case 'cursor':
      return <CursorAgentIcon size={size} />;
    case 'antigravity':
      return <AntigravityIcon size={size} />;
    default:
      return <ClaudeIcon size={size} />;
  }
}
