import React from 'react';

export default function ZedIcon({
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
      <rect width="24" height="24" rx="5" fill="#18181B" />
      <path
        d="M6 7H18L8 17H18"
        stroke="#F43F5E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
