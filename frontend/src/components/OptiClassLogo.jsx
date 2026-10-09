import React from 'react';

export default function ClassSquareLogo({ size = 'md', className = '' }) {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px] rounded-md',
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-9 h-9 text-sm rounded-xl',
    lg: 'w-12 h-12 text-lg rounded-2xl',
    xl: 'w-16 h-16 text-2xl rounded-2xl',
  };

  const dimensions = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={`inline-flex items-center justify-center font-black bg-blue-600 text-white shadow-sm flex-shrink-0 transition-transform hover:scale-105 select-none ${dimensions} ${className}`}
      style={{
        boxShadow: '0 4px 12px rgba(29, 97, 242, 0.25)',
      }}
    >
      <span className="font-black tracking-tight leading-none">C</span>
    </div>
  );
}

export { ClassSquareLogo };
