import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  trend?: string;
  color?: 'default' | 'emerald' | 'amber' | 'red' | 'sky';
}

const COLOR_MAP = {
  default: 'text-white',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  sky:     'text-sky-400',
};

export function StatCard({ label, value, trend, color = 'default' }: StatCardProps) {
  return (
    <div className="bg-[#0f172a] border border-white/[0.08] rounded-xl px-5 py-4">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
      {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
    </div>
  );
}

export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-6 py-4">
      {children}
    </div>
  );
}
