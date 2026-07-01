// Reusable presentation components for the Aurora design system.
import type { ReactNode } from 'react';
import { api } from '../lib/api';

// CSV / XLSX / PDF export buttons for a report endpoint.
export function ExportButtons({ path, name }: { path: string; name: string }) {
  const fmts: ('csv' | 'xlsx' | 'pdf')[] = ['csv', 'xlsx', 'pdf'];
  return (
    <div className="row" style={{ gap: 6 }}>
      {fmts.map((f) => (
        <button key={f} className="btn sm" onClick={() => api.exportReport(path, name, f)}>
          <i className="ti ti-download" aria-hidden="true" /> {f.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', pad = true }:
  { title?: string; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={`card ${pad ? '' : 'card-pad-0'} ${className}`}>
      {(title || action) && (
        <div className="card-head" style={pad ? undefined : { padding: '16px 18px 0' }}>
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
const toneVar: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: 'var(--brand-bg)', fg: 'var(--brand)' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  muted: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
};

export function StatCard({ label, value, icon, tone = 'brand', foot, footTone, spark }:
  { label: string; value: string; icon?: string; tone?: Tone; foot?: string; footTone?: 'up' | 'down'; spark?: number[] }) {
  const t = toneVar[tone];
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-ic" style={{ background: t.bg, color: t.fg }}><i className={`ti ti-${icon}`} aria-hidden="true" /></span>}
      </div>
      <div className="stat-value">{value}</div>
      {spark && (
        <div className="spark" aria-hidden="true">
          {spark.map((h, i) => <span key={i} className={i === spark.length - 1 ? 'lead' : ''} style={{ height: `${h}%` }} />)}
        </div>
      )}
      {foot && <div className={`stat-foot ${footTone ?? ''}`}>{foot}</div>}
    </div>
  );
}

export function Badge({ tone = 'muted', children }: { tone?: 'ok' | 'bad' | 'warn' | 'run' | 'muted'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange }:
  { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={`seg ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MeterRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="between" style={{ marginBottom: 5, fontSize: 13 }}>
        <span>{label}</span><span className="muted">{value}</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

// compact number formatting helpers shared by pages
export const compact = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
export const money = (n: number) => '$' + Math.round(n).toLocaleString();
