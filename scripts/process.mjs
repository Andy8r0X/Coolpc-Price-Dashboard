import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');
const PRICES_DIR = path.join(DOCS_DATA, 'prices');

/**
 * 商品名稱正規化，讓同一商品在不同時間能對齊
 */
function normalizeName(name) {
  return String(name)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]]/g, '')
    .replace(/[，,、]/g, '')
    .replace(/＄|\$|元/g, '')
    .trim();
}

/**
 * 商品穩定 ID（用於 URL 與前端 key）
 */
function makeId(name) {
  return Buffer.from(normalizeName(name)).toString('base64url').slice(0, 24);
}

/**
 * 讀取所有快照來源：
 * 1. docs/data/history.json（每日 live 累積）
 * 2. docs/data/prices/*.json（archive 抓的）
 * 合併、去重、排序
 */
async function loadAllSnapshots() {
  const all = [];

  // 1. history.json
  const historyFile = path.join(DOCS_DATA, 'history.json');
  if (existsSync(historyFile)) {
    try {
      const arr = JSON.parse(await readFile(historyFile, 'utf8'));
      console.log(`[process] history.json: ${arr.length} snapshots`);
      all.push(...arr);
    } catch (e) {
      console.warn('[process] history.json parse failed:', e.message);
    }
  } else {
    console.log('[process] history.json 不存在');
  }

  // 2. prices/*.json
  if (existsSync(PRICES_DIR)) {
    const files = (await readdir(PRICES_DIR))
      .filter((f) => f.endsWith('.json'))
      .sort();
    console.log(`[process] prices/ 目錄有 ${files.length} 個檔案: ${files.join(', ') || '(空)'}`);

    for (const f of files) {
      try {
        const arr = JSON.parse(await readFile(path.join(PRICES_DIR, f), 'utf8'));
        console.log(`[process]   ${f}: ${arr.length} snapshots`);
        all.push(...arr);
      } catch (e) {
        console.warn(`[process]   ${f} parse failed:`, e.message);
      }
    }
  } else {
    console.log('[process] prices/ 不存在');
  }

  // 3. 用 snapshotTime 去重
  const seen = new Set();
  const unique = [];
  for (const s of all) {
    if (!s || !s.snapshotTime) continue;
    if (seen.has(s.snapshotTime)) continue;
    seen.add(s.snapshotTime);
    unique.push(s);
  }

  // 4. 依時間排序
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

  console.log(`[process] 最早: ${snapshots[0].snapshotTime}`);
  console.log(`[process] 最新: ${snapshots[snapshots.length - 1].snapshotTime}`);

  // 商品時間序列：key = normalizeName(name)
  const series = new Map();

  for (const snap of snapshots) {
    if (!snap.categories) continue;
    for (const cat of snap.categories) {
      if (!cat.items) continue;
      for (const item of cat.items) {
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
    latestSnapshot: snapshots[snapshots.length - 1]?.snapshotTime || null,
    earliestSnapshot: snapshots[0]?.snapshotTime || null,
  };
  await writeFile(
    path.join(DOCS_DATA, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );

  console.log(
    `[process] wrote products.json (${products.length}), trends.json (${trends.length})`
  );
  console.log('[process] meta:', meta);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
