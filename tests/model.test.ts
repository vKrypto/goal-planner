import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, validDate, toMinor, emptyData, validateData, parseBackup, saveData, loadData, KEY, MAX_BYTES, safeLink, priceLabel, type Target, type Purchase } from '../src/model.ts';
const target: Target = { id: 'one', type: 'target', title: 'Run a 5K', description: '', notes: 'Start small', status: 'active', targetDate: '2026-12-31', reminder: true, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' };
test('calendar-day calculations cross leap days and years without DST or timezone shifts', () => {
 assert.equal(daysUntil('2027-01-01', '2026-12-31'), 1);
 assert.equal(daysUntil('2028-03-01', '2028-02-28'), 2);
 assert.equal(daysUntil('2026-03-09', '2026-03-08'), 1);
 assert.equal(daysUntil('2026-11-05', '2026-11-06'), -1);
 assert.equal(daysUntil('2026-11-06', '2026-11-06'), 0);
 assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2028-02-29'), true);
 assert.equal(validDate('2026-13-01'), false); assert.equal(validDate('0099-01-01'), false);
});
test('money uses integer minor units and respects currency precision', () => {
 assert.equal(toMinor('19.99', 'INR'), 1999); assert.equal(toMinor('0.10', 'USD'), 10); assert.equal(toMinor('100', 'JPY'), 100);
 for (const value of ['-1', '1.001', '', 'Infinity', '1e3', 'NaN']) assert.throws(() => toMinor(value, 'USD'));
 assert.throws(() => toMinor('1.1', 'JPY'));
 const item: Purchase = { ...target, type: 'purchase', name: 'Chair', link: '', pricingMode: 'range', price: 0, minimum: 10000, maximum: 15000, quantity: 2, purchaseDate: '' };
 assert.match(priceLabel(item, 'USD'), /200\.00.*300\.00/);
});
test('versioned backup round trip preserves notes, photos, completion and settings', () => {
 const data = { ...emptyData(), items: [{ ...target, status: 'completed' as const, completedAt: target.updatedAt, photo: 'data:image/jpeg;base64,YQ==' }] };
 assert.deepEqual(parseBackup(JSON.stringify(data)), validateData(data));
 const store = new Map<string,string>(); const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } };
 assert.deepEqual(loadData(storage), emptyData()); saveData(data, storage); assert.deepEqual(loadData(storage), validateData(data));
});
test('malformed, unsupported, duplicate and unsafe imported data is rejected', () => {
 assert.throws(() => parseBackup('{broken'));
 for (const data of [{ ...emptyData(), schemaVersion: 2 }, { ...emptyData(), items: [target, target] }, { ...emptyData(), items: [{ ...target, targetDate: '2026-02-30' }] }, { ...emptyData(), items: [{ ...target, photo: 'data:image/svg+xml,<svg/>' }] }, { ...emptyData(), items: [{ ...target, reminder: 'yes' }] }]) assert.throws(() => validateData(data));
 assert.equal(safeLink('javascript:alert(1)'), false); assert.equal(safeLink('https://example.com/product'), true);
 assert.throws(() => parseBackup(' '.repeat(MAX_BYTES)));
});
test('read and write failures preserve saved data rather than substituting an empty document', () => {
 const original = '{corrupted'; const store = new Map([[KEY, original]]);
 assert.throws(() => loadData({ getItem: key => store.get(key) ?? null })); assert.equal(store.get(KEY), original);
 assert.throws(() => saveData(emptyData(), { setItem: () => { throw new Error('QuotaExceededError'); } }), /Could not save/);
 assert.equal(store.get(KEY), original);
});
test('purchase import rejects inverted ranges, unsafe links and invalid quantities', () => {
 const purchase = { ...target, type: 'purchase', name: 'Chair', link: '', pricingMode: 'range', price: 0, minimum: 10000, maximum: 15000, quantity: 2, purchaseDate: '' };
 assert.equal(validateData({ ...emptyData(), items: [purchase] }).items.length, 1);
 for (const change of [{ minimum: 20000 }, { quantity: 0 }, { quantity: 1.2 }, { link: 'data:text/html,bad' }, { price: 0.1 }]) assert.throws(() => validateData({ ...emptyData(), items: [{ ...purchase, ...change }] }));
});
import { dateEnd, dueLabel as flexDue, validFlexDate, isFutureDate, displayDate as flexDisplay } from '../src/model.ts';
import assertFlex from 'node:assert/strict';
import testFlex from 'node:test';
testFlex('flexible purchase dates accept month and year, count to period end, and must be in the future', () => {
  assertFlex.ok(validFlexDate('2027') && validFlexDate('2027-03') && validFlexDate('2027-03-04') && !validFlexDate('2027-13'));
  assertFlex.equal(dateEnd('2028-02'), '2028-02-29'); assertFlex.equal(dateEnd('2027'), '2027-12-31');
  assertFlex.equal(flexDue('2026-11', '2026-11-06'), 'This month'); assertFlex.equal(flexDue('2027-01', '2026-11-06'), 'In 2 months'); assertFlex.equal(flexDue('2027', '2026-11-06'), 'Next year');
  assertFlex.ok(isFutureDate('2026-11', '2026-11-06') && !isFutureDate('2026-10', '2026-11-06') && isFutureDate('2026', '2026-11-06') && !isFutureDate('2026-11-05', '2026-11-06'));
  assertFlex.equal(flexDisplay('2027'), '2027');
});
