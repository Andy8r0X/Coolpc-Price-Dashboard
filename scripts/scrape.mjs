import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { request } from 'undici';
import { parseEvaluateHtml } from './lib/parse.mjs';

const MODE = process.env.MODE || 'live';   // live | archive | full
const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, 'data');
const PRICES_DIR = path.join(DATA_DIR, 'prices');
const CACHE_DIR = path.join(ROOT, 'cache', 'archive');

const LIVE_URL = 'https://ftp.coolpc.com.tw/evaluate.php';
const FALLBACK_URL = 'http://www.coolpc.com.tw/evaluate.php';
const TARGET = 'http://www.coolpc.com.tw/evaluate.php';
const CDX_API = 'http://web.archive.org/cdx/search/cdx';

const UA = 'Mozilla/5.0 (compatible; CoolpcDashboard/1.0; +https://github.com/andy8r0x)';

async function fetchText(url, timeoutMs = 30000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await request(url, {
      headers: { 'user-agent': UA, 'accept-language': 'zh-TW,zh;q=0.9' },
      signal: ac.signal,
    });
    if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
    return await res.body.text();
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDirs() {
  for (const d of [DATA_DIR, PRICES_DIR, CACHE_DIR]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }
}

async function saveSnapshot(snap) {
  const month = snap.snapshotTime.slice(0, 7); // YYYY-MM
  const file = path.join(PRICES_DIR, `${month}.json`);

  let arr = [];
  if (existsSync(file)) {
    try {
      arr = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      arr = [];
    }
  }

  // 同一天只留最後一筆（避免重複）
  const dayKey = snap.snapshotTime.slice(0, 10);
  arr = arr.filter((s) => s.snapshotTime.slice(0, 10) !== dayKey);
  arr.push(snap);
  arr.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));

  await writeFile(file, JSON.stringify(arr), 'utf8');
  console.log(`[save] ${file} (${arr.length} snapshots in ${month})`);
}

async function saveLatest(snap) {
  await writeFile(
    path.join(DATA_DIR, 'latest.json'),
    JSON.stringify(snap),
    'utf8',
  );
}

async function runLive() {
  console.log('[live] fetching', LIVE_URL);
  let html;
  try {
    html = await fetchText(LIVE_URL);
  } catch (e) {
    console.warn('[live] primary failed, fallback:', e.message);
    html = await fetchText(FALLBACK_URL);
  }
  const snap = parseEvaluateHtml(html);
  const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[live] parsed ${snap.categories.length} categories, ${total} items @ ${snap.snapshotTime}`);
  if (total === 0) {
    throw new Error('Parsed 0 items — DOM 結構可能改了，請檢查 parse.mjs');
  }
  await saveSnapshot(snap);
  await saveLatest(snap);
}

async function listArchiveSnapshots() {
  const url = `${CDX_API}?url=${encodeURIComponent(TARGET)}&output=json&fl=timestamp,statuscode,digest&filter=statuscode:200&collapse=digest`;
  const text = await fetchText(url, 60000);
  const rows = JSON.parse(text);
  return rows.slice(1); // 去掉 header
}

async function fetchArchiveSnapshot(ts) {
  const url = `http://web.archive.org/web/${ts}id_/${TARGET}`;
  const cached = path.join(CACHE_DIR, `${ts}.html`);
  if (existsSync(cached)) {
    return await readFile(cached, 'utf8');
  }
  const html = await fetchText(url, 60000);
  await writeFile(cached, html, 'utf8');
  await sleep(1500); // 禮貌延遲
  return html;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runArchive() {
  console.log('[archive] listing snapshots...');
  const snaps = await listArchiveSnapshots();
  console.log(`[archive] ${snaps.length} unique snapshots`);

  // 若 cache 已存在，跳過已處理的月份
  const processedMonths = new Set(
    (await readdir(PRICES_DIR).catch(() => []))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', '')),
  );
  console.log(`[archive] already have months: ${[...processedMonths].join(', ') || '(none)'}`);

  let saved = 0;
  for (let i = 0; i < snaps.length; i++) {
    const ts = snaps[i][0];              // YYYYMMDDHHMMSS
    const month = `${ts.slice(0, 4)}-${ts.slice(4, 6)}`;

    // 已有該月資料就跳過（增量）
    if (processedMonths.has(month)) continue;

    try {
      const html = await fetchArchiveSnapshot(ts);
      const snap = parseEvaluateHtml(html);
      const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
      if (total === 0) continue;
      // 覆寫 snapshotTime 為 archive 時間
      snap.snapshotTime = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} ${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}`;
      snap.source = 'archive';
      await saveSnapshot(snap);
      saved++;
      if (saved % 10 === 0) console.log(`[archive] saved ${saved} snapshots...`);
    } catch (e) {
      console.warn(`[archive] skip ${ts}: ${e.message}`);
    }
  }
  console.log(`[archive] done, saved ${saved} snapshots`);
}

async function main() {
  await ensureDirs();
  if (MODE === 'live' || MODE === 'full') await runLive();
  if (MODE === 'archive' || MODE === 'full') await runArchive();
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
