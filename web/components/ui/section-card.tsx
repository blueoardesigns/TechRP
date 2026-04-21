import React from 'react';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, children, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-[#0f172a] border border-white/[0.08] rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
