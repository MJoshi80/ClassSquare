import React from 'react';

export default function ClassSquareLogo({ size = 'md', showText = false, className = '' }) {
  const sizeClasses = {
    xs: 'w-5 h-5 text-xs',
    sm: 'w-7 h-7 text-sm',
    md: 'w-9 h-9 text-base',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-16 h-16 text-2xl',
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  const iconElement = (
    <div
      className={`inline-flex items-center justify-center font-black rounded-xl bg-blue-600 text-white shadow-sm flex-shrink-0 transition-transform hover:scale-105 ${currentSize} ${className}`}
      style={{
        boxShadow: '0 4px 12px rgba(29, 97, 242, 0.25)',
      }}
    >
      <span className="font-extrabold tracking-tight">C</span>
    </div>
  );

  if (!showText) {
    return iconElement;
  }

  return (
    <div className="inline-flex items-center gap-2.5">
      {iconElement}
      <span className="text-xl font-black text-slate-900 tracking-tight">
        Class<span className="text-[#1d61f2]">Square</span>
      </span>
    </div>
  );
}

export { ClassSquareLogo };
