const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export async function loadMeta() {
  const res = await fetch(`${BASE}/data/meta.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('meta.json not found');
  return res.json();
}

export async function loadProducts() {
  const res = await fetch(`${BASE}/data/products.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('products.json not found');
  return res.json();
}

export async function loadTrends() {
  const res = await fetch(`${BASE}/data/trends.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('trends.json not found');
  return res.json();
}

export function findProductById(trends, id) {
  return trends.find((t) => t.id === id) || null;
}
