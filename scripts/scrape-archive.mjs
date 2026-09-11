import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import iconv from 'iconv-lite';
import { parseEvaluateHtml } from './lib/parse.mjs';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');
const PRICES_DIR = path.join(DOCS_DATA, 'prices');
const CACHE_DIR = path.join(ROOT, 'cache', 'archive');

// 目標：只撈 2026-08-01 ~ 2026-09-30
const START = '20260801';
const END = '20260930';

const TARGET = 'http://www.coolpc.com.tw/evaluate.php';
const CDX_API = 'http://web.archive.org/cdx/search/cdx';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function ensureDirs() {
  for (const d of [DOCS_DATA, PRICES_DIR, CACHE_DIR]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 用 CDX API 列出指定日期範圍的快照
 */
async function listSnapshots() {
  const params = new URLSearchParams({
    url: TARGET,
    output: 'json',
    fl: 'timestamp,statuscode,digest',
    filter: 'statuscode:200',
    from: START,
    to: END,
    collapse: 'digest', // 去重複內容
  });

  const url = `${CDX_API}?${params}`;
  console.log('[cdx] fetching:', url);

  const res = await fetch(url, {
    headers: { 'user-agent': UA },
  });

  if (!res.ok) {
    throw new Error(`CDX API HTTP ${res.status}`);
  }

  const text = await res.text();
  if (!text.trim()) {
    console.warn('[cdx] 回傳空字串');
    return [];
  }

  let rows;
  try {
    rows = JSON.parse(text);
  } catch (e) {
    console.error('[cdx] JSON parse failed:', e.message);
    console.error('[cdx] raw text (first 500):', text.slice(0, 500));
    return [];
  }

  // rows[0] 是 header，之後才是資料
  if (rows.length <= 1) {
    console.warn('[cdx] 沒有快照');
    return [];
  }

  const header = rows[0];
  const data = rows.slice(1);
  console.log(`[cdx] 找到 ${data.length} 個快照`);
  console.log(`[cdx] header: ${header.join(', ')}`);

  return data.map((r) => ({
    timestamp: r[0],   // YYYYMMDDHHMMSS
    statuscode: r[1],
    digest: r[2],
  }));
}

/**
 * 抓單一快照的 HTML
 */
async function fetchSnapshot(timestamp) {
  // 用 id_ 取得原始 HTML（不帶 Wayback 工具列）
  const url = `http://web.archive.org/web/${timestamp}id_/${TARGET}`;
  const cacheFile = path.join(CACHE_DIR, `${timestamp}.html`);

  // 如果有 cache，直接用
  if (existsSync(cacheFile)) {
    console.log(`[fetch] cache hit: ${timestamp}`);
    const buf = await readFile(cacheFile);
    return buf;
  }

  console.log(`[fetch] ${timestamp} -> ${url}`);

  const res = await fetch(url, {
    headers: { 'user-agent': UA },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // 存到 cache
  await writeFile(cacheFile, buf);

  return buf;
}

/**
 * 從 buffer 解碼（自動偵測 Big5 / UTF-8）
 */
function decodeBuffer(buf) {
  // 先試 UTF-8，如果有 replacement character 就改 Big5
  const utf8 = iconv.decode(buf, 'utf-8');
  if (utf8.includes('\uFFFD')) {
    return iconv.decode(buf, 'big5');
  }
  return utf8;
}

async function main() {
  await ensureDirs();

  // 1. 列出快照
  const snapshots = await listSnapshots();
  if (snapshots.length === 0) {
    console.log('[main] 沒有快照，結束');
    return;
  }

  // 印出前 10 個
  console.log('[main] 前 10 個快照：');
  snapshots.slice(0, 10).forEach((s) => {
    const yyyy = s.timestamp.slice(0, 4);
    const mm = s.timestamp.slice(4, 6);
    const dd = s.timestamp.slice(6, 8);
    const hh = s.timestamp.slice(8, 10);
    const mi = s.timestamp.slice(10, 12);
    const ss = s.timestamp.slice(12, 14);
    console.log(`  ${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`);
  });

  // 2. 逐一抓取 + 解析
  let success = 0;
  let failed = 0;
  const monthlyData = new Map(); // '2026-08' -> [snap1, snap2, ...]

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const ts = s.timestamp;
    const month = `${ts.slice(0, 4)}-${ts.slice(4, 6)}`;

    try {
      const buf = await fetchSnapshot(ts);
      const html = decodeBuffer(buf);
      const snap = parseEvaluateHtml(html);

      const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
      console.log(`[parse] ${ts} -> ${snap.categories.length} categories, ${total} items`);

      if (total > 0) {
        // 覆寫 snapshotTime 為 archive 時間
        snap.snapshotTime = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} ${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}`;

        if (!monthlyData.has(month)) {
          monthlyData.set(month, []);
        }
        monthlyData.get(month).push(snap);
        success++;
      } else {
        console.warn(`[parse] ${ts} 解析到 0 筆，跳過`);
        failed++;
      }
    } catch (e) {
      console.error(`[fetch] ${ts} 失敗: ${e.message}`);
      failed++;
    }

    // 禮貌延遲，避免被 Archive.org 擋
    await sleep(1500);
  }

  console.log(`\n[main] 完成：成功 ${success}，失敗 ${failed}`);

  // 3. 存成分月檔案
  for (const [month, snaps] of monthlyData) {
    const file = path.join(PRICES_DIR, `${month}.json`);
    // 排序
    snaps.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));
    await writeFile(file, JSON.stringify(snaps), 'utf8');
    console.log(`[save] ${file} (${snaps.length} snapshots)`);
  }
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
