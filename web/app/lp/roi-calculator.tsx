'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const WORKING_DAYS_PER_MONTH = 22;

const formatMoney = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

export function RoiCalculator() {
  const [avgTicket, setAvgTicket] = useState(10000);
  const [callsPerDay, setCallsPerDay] = useState(2);
  const [closeRate, setCloseRate] = useState(50);
  const [margin, setMargin] = useState(70);
  const [lift, setLift] = useState(5);

  const result = useMemo(() => {
    const monthlyCalls = callsPerDay * WORKING_DAYS_PER_MONTH;
    const currentRev = monthlyCalls * (closeRate / 100) * avgTicket;
    const liftedRev = monthlyCalls * Math.min(100, closeRate + lift) / 100 * avgTicket;
    const currentMargin = currentRev * (margin / 100);
    const liftedMargin = liftedRev * (margin / 100);
    const monthlyDelta = liftedMargin - currentMargin;
    return {
      monthlyCalls,
      currentMargin,
      liftedMargin,
      monthlyDelta,
      annualDelta: monthlyDelta * 12,
    };
  }, [avgTicket, callsPerDay, closeRate, margin, lift]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      {/* ── Inputs ── */}
      <div className="lg:col-span-3 bg-slate-800/40 border border-white/5 rounded-2xl p-8 backdrop-blur">
        <p className="text-xs font-semibold tracking-[3px] text-indigo-400 uppercase mb-4">Per User</p>
        <h3 className="text-2xl font-bold mb-1">Your Numbers</h3>
        <p className="text-slate-500 text-sm mb-8">
          Calculated per rep who uses TechRP. Multiply by your team size for company-wide impact.
        </p>

        <div className="space-y-6">
          <Field
            label="Average ticket size"
            hint="Typical revenue per closed water/mold job"
            value={avgTicket}
            onChange={setAvgTicket}
            min={500}
            max={50000}
            step={500}
            prefix="$"
          />
          <Field
            label="Calls or visits per day"
            hint="Inbound calls, on-site visits, or BD meetings per rep"
            value={callsPerDay}
            onChange={setCallsPerDay}
            min={1}
            max={20}
            step={1}
          />
          <Field
            label="Current close rate"
            hint="% of opportunities your rep closes today"
            value={closeRate}
            onChange={setCloseRate}
            min={5}
            max={95}
            step={1}
            suffix="%"
          />
          <Field
            label="Gross margin"
            hint="Margin on water & mold remediation work"
            value={margin}
            onChange={setMargin}
            min={20}
            max={95}
            step={1}
            suffix="%"
          />

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200">
                Close-rate lift after TechRP training
              </label>
              <span className="text-indigo-300 font-bold tabular-nums">+{lift}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={lift}
              onChange={(e) => setLift(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>+1%</span>
              <span>+10% (typical)</span>
              <span>+15% (strong)</span>
              <span>+20%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="lg:col-span-2 bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/30 rounded-2xl p-8 shadow-[0_0_60px_rgba(99,102,241,0.15)]">
        <p className="text-xs font-semibold tracking-[3px] text-indigo-300 uppercase mb-4">
          Per Rep Using TechRP
        </p>

        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-1">Additional gross profit per month</p>
          <p className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent tabular-nums">
            {formatMoney(result.monthlyDelta)}
          </p>
        </div>

        <div className="mb-8">
          <p className="text-slate-400 text-sm mb-1">Additional gross profit per year</p>
          <p className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent tabular-nums leading-tight">
            {formatMoney(result.annualDelta)}
          </p>
        </div>

        <div className="space-y-2 text-sm text-slate-400 border-t border-white/10 pt-4 mb-6">
          <Row label="Calls / month" value={result.monthlyCalls.toLocaleString()} />
          <Row label="Current monthly margin" value={formatMoney(result.currentMargin)} />
          <Row label={`With +${lift}% lift`} value={formatMoney(result.liftedMargin)} />
        </div>

        <Link
          href="/signup"
          className="block w-full text-center py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_36px_rgba(99,102,241,0.6)] transition-shadow"
        >
          Capture this for my team →
        </Link>
        <p className="text-xs text-slate-500 text-center mt-3">
          Same leads. Same marketing spend. Better-trained reps.
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}

function Field({ label, hint, value, onChange, min, max, step, prefix, suffix }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-200 mb-1">{label}</label>
      <p className="text-xs text-slate-500 mb-2">{hint}</p>
      <div className="relative">
        {prefix && (
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-sm">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className={`w-full bg-slate-900/60 border border-white/10 rounded-lg py-2.5 text-white tabular-nums focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-8' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-slate-200 tabular-nums">{value}</span>
    </div>
  );
}
