import React from 'react';

export default function WindsurfIcon({
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
      <rect width="24" height="24" rx="5" fill="#0EA5E9" />
      <path
        d="M4 14C7 10 11 8 16 9C13 11 11 13 10 16C7.5 16 5.5 15.2 4 14Z"
        fill="#FFFFFF"
      />
      <path
        d="M8 19C12 15 16 13 20 14C17 16 15 18 14 20C11.5 20.5 9.5 20 8 19Z"
        fill="#FFFFFF"
        opacity="0.8"
      />
    </svg>
  );
}
