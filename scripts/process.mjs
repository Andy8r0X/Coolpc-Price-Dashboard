import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');

function normalizeName(name) {
  return String(name)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]]/g, '')
    .replace(/[，,、]/g, '')
    .replace(/＄|\$|元/g, '')
    .trim();
}

function makeId(name) {
  return Buffer.from(normalizeName(name)).toString('base64url').slice(0, 24);
}

async function main() {
  const historyFile = path.join(DOCS_DATA, 'history.json');
  if (!existsSync(historyFile)) {
    console.log('[process] 沒有 history.json，先跳過');
    return;
  }

  const history = JSON.parse(await readFile(historyFile, 'utf8'));
  console.log(`[process] ${history.length} snapshots`);

  // 商品時間序列
  const series = new Map();   // key -> { id, name, points: [] }

  for (const snap of history) {
    for (const cat of snap.categories) {
      for (const item of cat.items) {
        const key = normalizeName(item.name);
        if (!key) continue;

        if (!series.has(key)) {
          series.set(key, { id: makeId(item.name), name: item.name, category: cat.name || '未分類', points: [] });
        }
        series.get(key).points.push({
          t: snap.snapshotTime,
          p: item.price,
          hot: item.isHot ? 1 : 0,
          changed: item.isPriceChanged ? 1 : 0,
        });
      }
    }
  }

  console.log(`[process] ${series.size} unique products`);

  const products = [];
  const trends = [];

  for (const [key, entry] of series) {
    const pts = entry.points;
    if (pts.length === 0) continue;

    const latest = pts[pts.length - 1];
    const first = pts[0];
    const prices = pts.map((p) => p.p);
    const change = latest.p - first.p;
    const changePct = first.p ? +((change / first.p) * 100).toFixed(2) : 0;

    products.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      price: latest.p,
      change,
      changePct,
      min: Math.min(...prices),
      max: Math.max(...prices),
      snapshotTime: latest.t,
      spark: pts.slice(-20).map((p) => p.p),
    });

    trends.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      current: latest.p,
      min: Math.min(...prices),
      max: Math.max(...prices),
      change,
      changePct,
      points: pts,
    });
  }

  products.sort((a, b) => b.changePct - a.changePct);

  await writeFile(path.join(DOCS_DATA, 'products.json'), JSON.stringify(products), 'utf8');
  await writeFile(path.join(DOCS_DATA, 'trends.json'), JSON.stringify(trends), 'utf8');

  const meta = {
    generatedAt: new Date().toISOString(),
    snapshotCount: history.length,
    productCount: products.length,
    latestSnapshot: history[history.length - 1]?.snapshotTime || null,
    earliestSnapshot: history[0]?.snapshotTime || null,
  };
  await writeFile(path.join(DOCS_DATA, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log(`[process] wrote products.json (${products.length}), trends.json (${trends.length})`);
  console.log('[process] meta:', meta);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
