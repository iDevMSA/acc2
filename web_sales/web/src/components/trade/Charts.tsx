import React, { useState } from 'react';
import { formatNumber } from '../../lib/format';

// رسوم بيانية خفيفة بـ SVG (بدون مكتبات): أعمدة وخطوط، مع تلميح القيمة عند المرور.

export interface Point {
  label: string;
  value: number;
  /** قيمة ثانية للمقارنة (مثل المشتريات مقابل المبيعات) */
  value2?: number;
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
};

export const BarChart: React.FC<{ data: Point[]; height?: number; legend?: [string, string?] }> = ({ data, height = 240, legend }) => {
  const [hover, setHover] = useState<number | null>(null);
  const hasNeg = data.some((d) => d.value < 0 || (d.value2 ?? 0) < 0);
  const max = niceMax(Math.max(...data.map((d) => Math.max(Math.abs(d.value), Math.abs(d.value2 ?? 0))), 0));
  const W = Math.max(data.length * 56, 320);
  const H = height;
  const pad = 28;
  const zero = hasNeg ? H / 2 : H - pad;
  const scale = (hasNeg ? H / 2 - pad : H - pad * 2) / max;
  const bw = data[0]?.value2 !== undefined ? 16 : 28;
  return (
    <div className="relative">
      {legend && (
        <div className="mb-2 flex gap-4 text-xs text-ink-subtle">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-600" /> {legend[0]}
          </span>
          {legend[1] && (
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> {legend[1]}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto" dir="ltr">
        <svg width={W} height={H} className="block min-w-full">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={0} x2={W} y1={zero - f * max * scale} y2={zero - f * max * scale} className="stroke-slate-200" strokeDasharray="3 4" />
          ))}
          <line x1={0} x2={W} y1={zero} y2={zero} className="stroke-slate-300" />
          {data.map((d, i) => {
            const cx = i * 56 + 28;
            const bar = (v: number, x: number, cls: string) => (
              <rect x={x} width={bw} y={v >= 0 ? zero - v * scale : zero} height={Math.max(Math.abs(v) * scale, 1)} rx={3} className={cls} />
            );
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={cx - 28} width={56} y={0} height={H} fill="transparent" />
                {d.value2 !== undefined ? (
                  <>
                    {bar(d.value, cx - bw - 1, d.value < 0 ? 'fill-danger-600' : 'fill-brand-600')}
                    {bar(d.value2, cx + 1, 'fill-amber-400')}
                  </>
                ) : (
                  bar(d.value, cx - bw / 2, d.value < 0 ? 'fill-danger-600' : hover === i ? 'fill-brand-700' : 'fill-brand-600')
                )}
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute end-2 top-0 rounded-lg bg-ink px-3 py-1.5 text-xs text-white shadow-pop">
          <b>{data[hover].label}</b>: <span className="num">{formatNumber(data[hover].value)}</span>
          {data[hover].value2 !== undefined && (
            <>
              {' '}
              / <span className="num">{formatNumber(data[hover].value2)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const LineChart: React.FC<{ data: Point[]; height?: number; digits?: number }> = ({ data, height = 220, digits = 2 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0);
  const span = max - min || 1;
  const W = Math.max(data.length * 48, 320);
  const H = height;
  const pad = 24;
  const x = (i: number) => (data.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (data.length - 1));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  return (
    <div className="relative">
      <div className="overflow-x-auto" dir="ltr">
        <svg width={W} height={H} className="block min-w-full">
          {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-slate-300" />}
          <path d={`${path} L${x(data.length - 1)},${H - pad} L${x(0)},${H - pad} Z`} className="fill-brand-600/10" />
          <path d={path} fill="none" className="stroke-brand-600" strokeWidth={2} />
          {data.map((d, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x(i) - 20} width={40} y={0} height={H} fill="transparent" />
              <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3} className={d.value < 0 ? 'fill-danger-600' : 'fill-brand-600'} />
              {(data.length <= 14 || i % Math.ceil(data.length / 12) === 0) && (
                <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute end-2 top-0 rounded-lg bg-ink px-3 py-1.5 text-xs text-white shadow-pop">
          <b>{data[hover].label}</b>: <span className="num">{formatNumber(data[hover].value, digits)}</span>
        </div>
      )}
    </div>
  );
};

/** شريط أفقي للترتيب (أعلى الأصناف / الزبائن) */
export const RankBars: React.FC<{ data: Point[]; unit?: string }> = ({ data, unit }) => {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="num shrink-0 font-medium">
              {formatNumber(d.value)} {unit && <span className="text-xs font-normal text-ink-subtle">{unit}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${(Math.abs(d.value) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
