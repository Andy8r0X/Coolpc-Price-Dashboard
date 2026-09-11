import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { normalizeName, makeId, guessCategory } from './lib/normalize.mjs';

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, 'data');
const PRICES_DIR = path.join(DATA_DIR, 'prices');

async function loadAllSnapshots() {
  if (!existsSync(PRICES_DIR)) return [];
  const files = (await readdir(PRICES_DIR))
    .filter((f) => f.endsWith('.json'))
    .sort();
  const all = [];
  for (const f of files) {
    const arr = JSON.parse(await readFile(path.join(PRICES_DIR, f), 'utf8'));
    all.push(...arr);
  }
  all.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));
  return all;
}

async function main() {
  const snapshots = await loadAllSnapshots();
  console.log(`[process] loaded ${snapshots.length} snapshots`);

  // 商品時間序列：key = normalizeName(name)
  const series = new Map();   // key -> { id, name, category, points: [{t, p, hot, changed}] }
  const latestByKey = new Map();

  for (const snap of snapshots) {
    for (const cat of snap.categories) {
      for (const item of cat.items) {
        const key = normalizeName(item.name);
        if (!key) continue;

        if (!series.has(key)) {
          series.set(key, {
            id: makeId(item.name),
            name: item.name,
            category: cat.name || guessCategory(item.name),
            points: [],
          });
        }
        const entry = series.get(key);
        entry.points.push({
          t: snap.snapshotTime,
          p: item.price,
          hot: item.isHot ? 1 : 0,
          changed: item.isPriceChanged ? 1 : 0,
        });
        latestByKey.set(key, {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          price: item.price,
          note: item.note || '',
          isHot: !!item.isHot,
          isPriceChanged: !!item.isPriceChanged,
          snapshotTime: snap.snapshotTime,
        });
      }
    }
  }

  console.log(`[process] ${series.size} unique products`);

  // 建立 trends
  const trends = [];
  for (const [key, entry] of series) {
    const pts = entry.points;
    if (pts.length === 0) continue;

    const latest = pts[pts.length - 1];
    const first = pts[0];
    const prices = pts.map((p) => p.p);
    const change = latest.p - first.p;
    const changePct = first.p ? +((change / first.p) * 100).toFixed(2) : 0;

    trends.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      current: latest.p,
      min: Math.min(...prices),
      max: Math.max(...prices),
      change,
      changePct,
      snapshotTime: latest.t,
      points: pts.slice(-60),   // 只留最近 60 點，控制檔案大小
    });
  }

  // 排序：漲跌幅 desc
  trends.sort((a, b) => b.changePct - a.changePct);

  // 輸出 products.json（最新快照，精簡版，給列表頁）
  const products = [...latestByKey.values()].map((p) => {
    const t = trends.find((x) => x.id === p.id);
    return {
      ...p,
      change: t?.change ?? 0,
      changePct: t?.changePct ?? 0,
      min: t?.min ?? p.price,
      max: t?.max ?? p.price,
      spark: t?.points?.slice(-20).map((x) => x.p) ?? [p.price],
    };
  });

  const meta = {
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    productCount: products.length,
    latestSnapshot: snapshots[snapshots.length - 1]?.snapshotTime ?? null,
    earliestSnapshot: snapshots[0]?.snapshotTime ?? null,
  };

  await writeFile(path.join(DATA_DIR, 'trends.json'), JSON.stringify(trends), 'utf8');
  await writeFile(path.join(DATA_DIR, 'products.json'), JSON.stringify(products), 'utf8');
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log(`[process] wrote trends.json (${trends.length}), products.json (${products.length})`);
  console.log(`[process] meta:`, meta);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
