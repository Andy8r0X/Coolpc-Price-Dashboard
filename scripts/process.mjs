import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');
const PRICES_DIR = path.join(DOCS_DATA, 'prices');

// 壓縮參數
const MIN_CHANGE_PCT = 0;      // 0 = 只壓縮「完全相同」的價格；0.5 = 變動小於 0.5% 不記
const MAX_TREND_POINTS = 100;  // 壓縮後最多留幾個點（保險）

function normalizeName(name) {
  return String(name)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/【(現貨|訂|限量|限組裝|預購|缺貨|搭機|加購)】/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/[★◆▼↘]/g, '')
    .replace(/＄|\$|元/g, '')
    .replace(/[，,、]/g, '')
    .trim();
}

function makeId(name) {
  return Buffer.from(normalizeName(name)).toString('base64url').slice(0, 24);
}

/**
 * 壓縮時間序列：
 * 只保留價格變化的點（及終點）
 */
function compressPoints(points, minChangePct = 0) {
  if (points.length <= 2) return points;

  const result = [points[0]];
  let lastKept = points[0];

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const diffPct = lastKept.p === 0
      ? 0
      : Math.abs((curr.p - lastKept.p) / lastKept.p) * 100;

    if (diffPct >= minChangePct && curr.p !== lastKept.p) {
      result.push(curr);
      lastKept = curr;
    }
  }

  // 確保終點在裡面
  const last = points[points.length - 1];
  if (result[result.length - 1].t !== last.t) {
    result.push(last);
  }

  return result;
}

async function loadAllSnapshots() {
  const all = [];

  const historyFile = path.join(DOCS_DATA, 'history.json');
  if (existsSync(historyFile)) {
    try {
      const arr = JSON.parse(await readFile(historyFile, 'utf8'));
      console.log(`[process] history.json: ${arr.length} snapshots`);
      all.push(...arr);
    } catch (e) {
      console.warn('[process] history.json parse failed:', e.message);
    }
  }

  if (existsSync(PRICES_DIR)) {
    const files = (await readdir(PRICES_DIR))
      .filter((f) => f.endsWith('.json'))
      .sort();
    console.log(`[process] prices/ 目錄有 ${files.length} 個檔案`);
    for (const f of files) {
      try {
        const arr = JSON.parse(await readFile(path.join(PRICES_DIR, f), 'utf8'));
        all.push(...arr);
      } catch (e) {
        console.warn(`[process]   ${f} parse failed:`, e.message);
      }
    }
  }

  const seen = new Set();
  const unique = [];
  for (const s of all) {
    if (!s || !s.snapshotTime) continue;
    if (seen.has(s.snapshotTime)) continue;
    seen.add(s.snapshotTime);
    unique.push(s);
  }
  unique.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));
  console.log(`[process] 合併後 ${unique.length} snapshots（去重後）`);
  return unique;
}

async function main() {
  const snapshots = await loadAllSnapshots();
  if (snapshots.length === 0) {
    console.log('[process] 沒有任何快照，結束');
    return;
  }

  const latestSnapshotTime = snapshots[snapshots.length - 1].snapshotTime;
  console.log(`[process] 最早: ${snapshots[0].snapshotTime}`);
  console.log(`[process] 最新: ${latestSnapshotTime}`);

  // 最新快照的商品集合
  const latestNames = new Set();
  for (const snap of snapshots) {
    if (snap.snapshotTime !== latestSnapshotTime) continue;
    for (const cat of snap.categories || []) {
      for (const item of cat.items || []) {
        latestNames.add(normalizeName(item.name));
      }
    }
  }
  console.log(`[process] 最新快照有 ${latestNames.size} 個商品`);

  // 建時間序列
  const series = new Map();
  for (const snap of snapshots) {
    for (const cat of snap.categories || []) {
      for (const item of cat.items || []) {
        const key = normalizeName(item.name);
        if (!key) continue;
        if (!series.has(key)) {
          series.set(key, {
            id: makeId(item.name),
            name: item.name,
            category: cat.name || '未分類',
            points: [],
          });
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
  console.log(`[process] ${series.size} unique products（全部歷史）`);

  const products = [];
  const trends = [];

  let rawTotal = 0;
  let compressedTotal = 0;

  for (const [key, entry] of series) {
    if (!latestNames.has(key)) continue;

    const pts = entry.points;
    if (pts.length === 0) continue;

    const latest = pts[pts.length - 1];
    const first = pts[0];
    const prices = pts.map((p) => p.p);
    const change = latest.p - first.p;
    const changePct = first.p ? +((change / first.p) * 100).toFixed(2) : 0;

    // 壓縮
    let compressed = compressPoints(pts, MIN_CHANGE_PCT);

    // 保險：如果壓縮後還是太多，再截斷
    if (compressed.length > MAX_TREND_POINTS) {
      compressed = compressed.slice(-MAX_TREND_POINTS);
    }

    rawTotal += pts.length;
    compressedTotal += compressed.length;

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
      spark: compressed.slice(-20).map((p) => p.p),
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
      points: compressed,
      rawPointCount: pts.length,
    });
  }

  console.log(`[process] products: ${products.length}, trends: ${trends.length}`);
  console.log(`[process] 壓縮前總點數: ${rawTotal}`);
  console.log(`[process] 壓縮後總點數: ${compressedTotal}`);
  console.log(`[process] 壓縮率: ${((1 - compressedTotal / rawTotal) * 100).toFixed(1)}%`);

  products.sort((a, b) => b.changePct - a.changePct);

  await writeFile(
    path.join(DOCS_DATA, 'products.json'),
    JSON.stringify(products),
    'utf8'
  );
  await writeFile(
    path.join(DOCS_DATA, 'trends.json'),
    JSON.stringify(trends),
    'utf8'
  );

  const meta = {
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    productCount: products.length,
    latestSnapshot: latestSnapshotTime,
    earliestSnapshot: snapshots[0]?.snapshotTime || null,
  };
  await writeFile(
    path.join(DOCS_DATA, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );

  console.log('[process] meta:', meta);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
