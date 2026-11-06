import { Cpu, Dumbbell, Guitar, HeartPulse, Home, Pill, Shirt, ShoppingBag, Sparkles, SprayCan, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { type Purchase } from './model';

/**
 * Frontend-only category → default icon mapping. Used when a purchase has no photo.
 * Matching is case-insensitive on the category name, then on keywords in the category or item name.
 * Add or edit entries here; nothing in this file is stored in the database.
 */
export type CategoryStyle = { label: string; icon: LucideIcon; color: string; tint: string; keywords: string[] };
export const CATEGORY_STYLES: CategoryStyle[] = [
  { label: 'Tech', icon: Cpu, color: '#4f6d8f', tint: '#e8eef5', keywords: ['tech', 'ram', 'hdd', 'ssd', 'monitor', 'switch', 'hotspot', 'power bank', 'laptop', 'phone', 'cable', 'router'] },
  { label: 'Gym', icon: Dumbbell, color: '#8f5f4f', tint: '#f5ebe7', keywords: ['gym', 'zym', 'fitness', 'weight', 'treadmill', 'tredmil', 'machine', 'massager'] },
  { label: 'Skincare', icon: Sparkles, color: '#9a7a3f', tint: '#f7f0e2', keywords: ['skin', 'face', 'serum', 'sunscreen', 'spf', 'retin', 'mask', 'lotion', 'self care'] },
  { label: 'Hair care', icon: SprayCan, color: '#7a6a9a', tint: '#efecf5', keywords: ['hair', 'shampoo', 'conditioner', 'rosemary', 'coconut oil'] },
  { label: 'Body care', icon: Shirt, color: '#5f8a7a', tint: '#e6f1ec', keywords: ['body', 'scrub', 'wash', 'deo'] },
  { label: 'Health', icon: Pill, color: '#a05a6a', tint: '#f6e9ec', keywords: ['supplement', 'vitamin', 'collagen', 'omega', 'capsule', 'teeth', 'perfora', 'dettol', 'health', 'hygiene'] },
  { label: 'Food', icon: UtensilsCrossed, color: '#8a7a4a', tint: '#f3f0e3', keywords: ['food', 'honey', 'cooking', 'baking', 'kitchen'] },
  { label: 'Interests', icon: Guitar, color: '#6a7f4a', tint: '#edf2e3', keywords: ['interest', 'hobby', 'guitar', 'music', 'book', 'game'] },
  { label: 'Home', icon: Home, color: '#6f7b62', tint: '#eef0e9', keywords: ['home', 'furniture', 'decor', 'chair'] },
  { label: 'Wellness', icon: HeartPulse, color: '#a06a5a', tint: '#f6ece8', keywords: ['wellness', 'care'] },
];
export const OTHER_STYLE: CategoryStyle = { label: 'Other', icon: ShoppingBag, color: '#7c8c66', tint: '#f0f3e9', keywords: [] };
export const DEFAULT_CATEGORIES = CATEGORY_STYLES.map(c => c.label);

export function categoryStyle(category = '', name = ''): CategoryStyle {
  const c = category.trim().toLowerCase();
  const exact = CATEGORY_STYLES.find(s => s.label.toLowerCase() === c);
  if (exact) return exact;
  const byCategory = c && CATEGORY_STYLES.find(s => s.keywords.some(k => c.includes(k)));
  if (byCategory) return byCategory;
  const n = name.toLowerCase();
  return CATEGORY_STYLES.find(s => s.keywords.some(k => n.includes(k))) ?? OTHER_STYLE;
}
export const categoryName = (p: Purchase) => p.category?.trim() || 'Uncategorised';

export function CategoryArt({ item, size = 'card' }: { item: Purchase; size?: 'card' | 'small' }) {
  const s = categoryStyle(item.category, item.name); const Icon = s.icon;
  return <span className={`category-art ${size}`} style={{ background: s.tint, color: s.color }} aria-hidden="true"><Icon size={size === 'card' ? 34 : 16} strokeWidth={1.6}/></span>;
}
