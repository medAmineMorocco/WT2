import React from 'react';

export function PowerShellIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#012456" />
      <path
        d="M9 9L18 16L9 23"
        stroke="#4CC2FF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="18"
        y1="23"
        x2="24"
        y2="23"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CmdIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#1E1E1E" stroke="#444" strokeWidth="1" />
      <path
        d="M7 10L13 16L7 22"
        stroke="#CCCCCC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="14"
        y1="22"
        x2="22"
        y2="22"
        stroke="#CCCCCC"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GitBashIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#F05032" />
      <path
        d="M20 12L15 7L13.5 8.5L15.5 10.5C14.8 10.9 14.3 11.7 14.3 12.6C14.3 13.5 14.8 14.3 15.6 14.7L13.5 16.8C13.2 16.7 12.8 16.6 12.5 16.6C11.4 16.6 10.5 17.5 10.5 18.6C10.5 19.7 11.4 20.6 12.5 20.6C13.6 20.6 14.5 19.7 14.5 18.6C14.5 18.1 14.3 17.7 14.1 17.4L16.2 15.3C16.5 15.4 16.8 15.5 17.2 15.5C17.7 15.5 18.2 15.3 18.6 14.9L21.5 17.8C21.4 18.1 21.3 18.3 21.3 18.6C21.3 19.7 22.2 20.6 23.3 20.6C24.4 20.6 25.3 19.7 25.3 18.6C25.3 17.5 24.4 16.6 23.3 16.6C22.8 16.6 22.4 16.8 22.1 17.1L19.2 14.2C19.8 13.5 19.9 12.5 19.4 11.7L21.5 9.6L20 8.1L20 12Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function FishIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#D84315" />
      <path
        d="M24 16C24 12 18 8 10 10C8 12 6 15 8 18C11 22 20 23 24 16Z"
        fill="#FFFFFF"
      />
      <circle cx="21" cy="14" r="1.5" fill="#D84315" />
      <path
        d="M8 15L4 12V20L8 17"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function LinuxWslIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#263238" />
      <path
        d="M16 6C13.5 6 12 8 12 11V16C10 18 8 20 8 23C8 25 10 26 13 26H19C22 26 24 25 24 23C24 20 22 18 20 16V11C20 8 18.5 6 16 6Z"
        fill="#FFA000"
      />
      <circle cx="14" cy="11" r="1.2" fill="#000000" />
      <circle cx="18" cy="11" r="1.2" fill="#000000" />
    </svg>
  );
}

export function GenericShellIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#10B981" />
      <path
        d="M8 10L14 16L8 22"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="16"
        y1="22"
        x2="24"
        y2="22"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function getShellIcon(iconType: string, size = 28) {
  switch (iconType) {
    case 'powershell':
      return <PowerShellIcon size={size} />;
    case 'cmd':
      return <CmdIcon size={size} />;
    case 'git':
      return <GitBashIcon size={size} />;
    case 'fish':
      return <FishIcon size={size} />;
    case 'linux':
      return <LinuxWslIcon size={size} />;
    default:
      return <GenericShellIcon size={size} />;
  }
}
