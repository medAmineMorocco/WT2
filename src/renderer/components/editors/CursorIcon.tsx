import React from 'react';

export default function CursorIcon({
  width = '30px',
  height = '30px',
}: {
  width?: string;
  height?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
    >
      <rect width="24" height="24" rx="5" fill="#000000" />
      <path
        d="M6 18L13 4L14.5 12L18 14L6 18Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
