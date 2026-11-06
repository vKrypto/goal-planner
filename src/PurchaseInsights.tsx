import { useState } from 'react';
import { type Currency, type Expense, type Purchase, money, dateEnd } from './model';
import { categoryName, categoryStyle } from './categories';

/** Total for a purchase: exact price × qty, or the midpoint of a range × qty. */
export const spendOf = (p: Purchase | Expense) => p.type === 'expense' ? p.amount : (p.pricingMode === 'exact' ? p.price : (p.minimum + p.maximum) / 2) * p.quantity;
const monthKey = (p: Purchase | Expense) => p.type === 'expense' ? p.expenseDate.slice(0, 7) : p.status === 'completed' ? (p.completedAt ?? p.updatedAt).slice(0, 7) : p.purchaseDate ? dateEnd(p.purchaseDate).slice(0, 7) : 'anytime';
const monthLabel = (key: string) => key === 'anytime' ? 'Anytime' : new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(`${key}-01T12:00:00`));
const compact = (v: number, c: Currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency: c, notation: 'compact', maximumFractionDigits: 1 }).format(v / (c === 'JPY' ? 1 : 100));

export function PurchaseInsights({ items, currency }: { items: (Purchase | Expense)[]; currency: Currency }) {
  const isExpense = items[0]?.type === 'expense'; const doneLabel = isExpense ? 'Paid' : 'Purchased'; const openLabel = isExpense ? 'Unpaid' : 'Planned';
  const [view, setView] = useState<'category' | 'month'>('category');
  if (!items.length) return null;
  const rows = new Map<string, { bought: number; planned: number }>();
  for (const p of items) {
    const key = view === 'category' ? categoryName(p) : monthKey(p);
    const row = rows.get(key) ?? { bought: 0, planned: 0 };
    row[p.status === 'completed' ? 'bought' : 'planned'] += spendOf(p); rows.set(key, row);
  }
  const list = [...rows.entries()].sort(view === 'category' ? (a, b) => (b[1].bought + b[1].planned) - (a[1].bought + a[1].planned) : (a, b) => a[0] === 'anytime' ? 1 : b[0] === 'anytime' ? -1 : a[0].localeCompare(b[0]));
  const max = Math.max(1, ...list.map(([, r]) => r.bought + r.planned));
  const bought = items.filter(p => p.status === 'completed').reduce((s, p) => s + spendOf(p), 0);
  const planned = items.filter(p => p.status === 'active').reduce((s, p) => s + spendOf(p), 0);
  return <section className="insights" aria-label="Purchase spending">
    <div className="insights-head"><div><span className="eyebrow">{isExpense ? 'EXPENSE OVERVIEW' : 'SPENDING OVERVIEW'}</span><p><strong>{money(bought, currency)}</strong> {doneLabel.toLowerCase()} · <strong>{money(planned, currency)}</strong> {isExpense ? 'unpaid' : 'still planned'}</p></div>
      <div className="segmented" role="group" aria-label="Group spending by">{(['category', 'month'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'selected' : ''} onClick={() => setView(v)}>{v === 'category' ? 'By category' : 'By month'}</button>)}</div></div>
    <div className="legend"><span><i className="swatch bought"/>{doneLabel}</span><span><i className="swatch planned"/>{openLabel}</span>{list.some(([, r]) => r.planned && items.some(p => p.type === 'purchase' && p.pricingMode === 'range')) && <small>Price ranges use the midpoint</small>}</div>
    <ul className="bars">{list.map(([key, r]) => { const s = view === 'category' ? categoryStyle(key === 'Uncategorised' ? '' : key, '', isExpense ? 'expense' : 'purchase') : undefined; const Icon = s?.icon; return <li key={key}>
      <span className="bar-label">{Icon && <Icon size={13} style={{ color: s!.color }}/>}{view === 'category' ? key : monthLabel(key)}</span>
      <span className="bar-track" title={`${money(r.bought, currency)} ${doneLabel.toLowerCase()} · ${money(r.planned, currency)} ${openLabel.toLowerCase()}`}><span className="bar bought" style={{ width: `${r.bought / max * 100}%` }}/><span className="bar planned" style={{ width: `${r.planned / max * 100}%` }}/></span>
      <span className="bar-value">{compact(r.bought + r.planned, currency)}</span></li>; })}</ul>
  </section>;
}
