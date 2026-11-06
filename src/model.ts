export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY';
export type BaseItem = { id: string; status: 'active' | 'completed'; notes: string; photo?: string; createdAt: string; updatedAt: string; completedAt?: string };
export type Target = BaseItem & { type: 'target'; title: string; description: string; targetDate: string; reminder: boolean };
export type Purchase = BaseItem & { type: 'purchase'; name: string; link: string; pricingMode: 'exact' | 'range'; price: number; minimum: number; maximum: number; quantity: number; purchaseDate: string };
export type Item = Target | Purchase;
export type Data = { schemaVersion: 1; settings: { currency: Currency }; items: Item[] };
export const KEY = 'target-planner.v1';
export const MAX_BYTES = 3_500_000;
export const emptyData = (): Data => ({ schemaVersion: 1, settings: { currency: 'INR' }, items: [] });
export const titleOf = (item: Item) => item.type === 'target' ? item.title : item.name;
export const dateOf = (item: Item) => item.type === 'target' ? item.targetDate : item.purchaseDate;
export function todayString(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(y, m - 1, d);
  return y >= 1900 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export type DatePrecision = 'day' | 'month' | 'year';
export const datePrecision = (value: string): DatePrecision => value.length === 4 ? 'year' : value.length === 7 ? 'month' : 'day';
/** Purchase dates may be a day (YYYY-MM-DD), a month (YYYY-MM) or a year (YYYY). */
export function validFlexDate(value: string): boolean {
  if (/^\d{4}$/.test(value)) return validDate(`${value}-01-01`);
  if (/^\d{4}-\d{2}$/.test(value)) return validDate(`${value}-01`);
  return validDate(value);
}
/** Last calendar day covered by a flexible date, so "Dec 2026" counts down to 31 Dec. */
export function dateEnd(value: string) {
  const p = datePrecision(value); if (p === 'day') return value;
  const [y, m] = value.split('-').map(Number); const month = p === 'year' ? 12 : m;
  return `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(y, month, 0)).getUTCDate()).padStart(2, '0')}`;
}
/** Smallest allowed value at each precision: today, this month, this year. */
export function minFlexDate(precision: DatePrecision, today = todayString()) { return precision === 'year' ? today.slice(0, 4) : precision === 'month' ? today.slice(0, 7) : today; }
export const isFutureDate = (value: string, today = todayString()) => value >= minFlexDate(datePrecision(value), today);
function dayNumber(value: string) { const [y, m, d] = dateEnd(value).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; }
export const daysUntil = (value: string, today = todayString()) => dayNumber(value) - dayNumber(today);
export function dueLabel(date: string, today = todayString()) {
  if (!date) return 'Whenever you’re ready';
  const p = datePrecision(date);
  if (p !== 'day' && daysUntil(date, today) >= 0) {
    const months = p === 'year' ? Number(date) - Number(today.slice(0, 4)) : (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(today.slice(5, 7));
    if (p === 'year') return months === 0 ? 'This year' : months === 1 ? 'Next year' : `In ${months} years`;
    return months === 0 ? 'This month' : months === 1 ? 'Next month' : `In ${months} months`;
  }
  const days = daysUntil(date); return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : `${days} days to go`;
}
export function displayDate(value: string) {
  if (!value) return 'No date set';
  const p = datePrecision(value);
  if (p === 'year') return value;
  if (p === 'month') return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
export const precision = (currency: Currency) => currency === 'JPY' ? 0 : 2;
export function toMinor(value: string, currency: Currency) { const number = Number(value); const digits = precision(currency); if (!value.trim() || !Number.isFinite(number) || number < 0 || !/^\d+(\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > digits) throw new Error(`Enter a valid amount with up to ${digits} decimal places.`); const amount = Math.round(number * 10 ** digits); if (!Number.isSafeInteger(amount) || amount > 1e12) throw new Error('That amount is too large.'); return amount; }
export const money = (value: number, currency: Currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: precision(currency) }).format(value / 10 ** precision(currency));
export function priceLabel(item: Purchase, currency: Currency) { return item.pricingMode === 'exact' ? money(item.price * item.quantity, currency) : `${money(item.minimum * item.quantity, currency)} – ${money(item.maximum * item.quantity, currency)}`; }
export function safeLink(link: string) { try { const url = new URL(link); return ['http:', 'https:'].includes(url.protocol); } catch { return false; } }
function fail(): never { throw new Error('This backup is invalid or uses an unsupported version. Your existing plans have not changed.'); }
export function validateData(value: unknown): Data {
  if (!value || typeof value !== 'object') return fail();
  const root = value as Data;
  if (root.schemaVersion !== 1 || !root.settings || !['INR', 'USD', 'EUR', 'GBP', 'JPY'].includes(root.settings.currency) || !Array.isArray(root.items) || root.items.length > 5000) return fail();
  const ids = new Set<string>();
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const amount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
  for (const item of root.items) {
    if (!item || typeof item !== 'object' || !str(item.id, 100) || !item.id || ids.has(item.id) || !['active', 'completed'].includes(item.status) || !str(item.notes, 10000) || !str(item.createdAt, 40) || !Number.isFinite(Date.parse(item.createdAt)) || !str(item.updatedAt, 40) || !Number.isFinite(Date.parse(item.updatedAt))) return fail();
    ids.add(item.id);
    if (item.completedAt !== undefined && (!str(item.completedAt, 40) || !Number.isFinite(Date.parse(item.completedAt)))) return fail();
    if (item.photo !== undefined && (!str(item.photo, 180000) || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(item.photo))) return fail();
    if (item.type === 'target') { if (!str(item.title, 120) || !item.title.trim() || !str(item.description, 1000) || !str(item.targetDate, 10) || !validDate(item.targetDate) || typeof item.reminder !== 'boolean') return fail(); }
    else if (item.type === 'purchase') { if (!str(item.name, 120) || !item.name.trim() || !str(item.link, 2000) || (item.link && !safeLink(item.link)) || !['exact', 'range'].includes(item.pricingMode) || !amount(item.price) || !amount(item.minimum) || !amount(item.maximum) || item.minimum > item.maximum || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999 || !Number.isSafeInteger(Math.max(item.price, item.maximum) * item.quantity) || !str(item.purchaseDate, 10) || (item.purchaseDate && !validFlexDate(item.purchaseDate))) return fail(); }
    else return fail();
  }
  // Reconstruct known fields; imported unknown properties never become application state.
  return { schemaVersion: 1, settings: { currency: root.settings.currency }, items: root.items.map(item => {
    const common = { id: item.id, status: item.status, notes: item.notes, photo: item.photo, createdAt: item.createdAt, updatedAt: item.updatedAt, completedAt: item.completedAt };
    return item.type === 'target' ? { ...common, type: 'target', title: item.title, description: item.description, targetDate: item.targetDate, reminder: item.reminder } : { ...common, type: 'purchase', name: item.name, link: item.link, pricingMode: item.pricingMode, price: item.price, minimum: item.minimum, maximum: item.maximum, quantity: item.quantity, purchaseDate: item.purchaseDate };
  }) };
}
export function parseBackup(raw: string) { if (raw.length > MAX_BYTES) throw new Error('This backup is too large for local storage.'); try { return validateData(JSON.parse(raw)); } catch (error) { if (error instanceof SyntaxError) throw new Error('This file is not valid JSON. Your existing plans have not changed.'); throw error; } }
export function loadData(storage: Pick<Storage, 'getItem'>): Data { const raw = storage.getItem(KEY); return raw === null ? emptyData() : parseBackup(raw); }
export function saveData(data: Data, storage: Pick<Storage, 'setItem'>) { const raw = JSON.stringify(validateData(data)); if (raw.length > MAX_BYTES) throw new Error('Storage is nearly full. Remove a photo or export a backup before adding more.'); try { storage.setItem(KEY, raw); } catch { throw new Error('Could not save to this browser. Storage may be full or unavailable. Export a backup and try removing a photo.'); } }
export async function compressPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.75, .6, .45, .3]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= 180000) return data; }
    throw new Error('This photo is too detailed to store. Try a smaller image.');
  } finally { bitmap.close(); }
}
