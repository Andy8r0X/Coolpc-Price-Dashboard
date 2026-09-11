import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { parseEvaluateHtml } from './lib/parse.mjs';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');
const CACHE = path.join(ROOT, 'cache');

const URL = 'https://ftp.coolpc.com.tw/evaluate.php';
const FALLBACK_URL = 'http://www.coolpc.com.tw/evaluate.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function ensureDirs() {
  for (const d of [DOCS_DATA, CACHE]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }
}

async function fetchHtml(url) {
  console.log('[fetch] URL:', url);

  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'referer': 'https://www.coolpc.com.tw/',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  console.log('[fetch] HTTP status:', res.status);
  console.log('[fetch] content-type:', res.headers.get('content-type'));

  const html = await res.text();
  console.log('[fetch] HTML length:', html.length);

  // ===== 診斷輸出 =====
  console.log('[diag] 包含 <select:', html.includes('<select'));
  console.log('[diag] 包含 <option:', html.includes('<option'));
  console.log('[diag] 包含 optgroup:', html.includes('optgroup'));
  console.log('[diag] 包含 RTX:', html.includes('RTX'));
  console.log('[diag] 包含 Ryzen:', html.includes('Ryzen'));
  console.log('[diag] 包含 Intel:', html.includes('Intel'));
  console.log('[diag] 包含 估價時間:', html.includes('估價時間'));
  console.log('[diag] 包含 class="t":', html.includes('class="t"'));

  const selectCount = (html.match(/<select/g) || []).length;
  const optionCount = (html.match(/<option/g) || []).length;
  console.log('[diag] <select> 數量:', selectCount);
  console.log('[diag] <option> 數量:', optionCount);

  console.log('[diag] HTML 前 500 字:');
  console.log(html.slice(0, 500));
  // ===== 診斷結束 =====

  return html;
}

async function saveSnapshot(snap) {
  // 存一份 latest.json
  await writeFile(
    path.join(DOCS_DATA, 'latest.json'),
    JSON.stringify(snap),
    'utf8'
  );

  // 累積到 history.json
  const historyFile = path.join(DOCS_DATA, 'history.json');
  let history = [];
  if (existsSync(historyFile)) {
    try {
      history = JSON.parse(await readFile(historyFile, 'utf8'));
    } catch {
      history = [];
    }
  }

  history = history.filter((h) => h.snapshotTime !== snap.snapshotTime);
  history.push(snap);
  history.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));
  if (history.length > 365) history = history.slice(-365);

  await writeFile(historyFile, JSON.stringify(history), 'utf8');
  console.log(`[save] latest.json + history.json (${history.length} snapshots)`);
}

async function main() {
  await ensureDirs();

  // 抓 HTML（主要 URL 失敗就 fallback）
  let html;
  try {
    html = await fetchHtml(URL);
  } catch (e) {
    console.warn('[fetch] primary failed:', e.message);
    console.warn('[fetch] trying fallback:', FALLBACK_URL);
    html = await fetchHtml(FALLBACK_URL);
  }

  // 存一份到 cache 方便 debug
  await writeFile(path.join(CACHE, 'last.html'), html, 'utf8');
  console.log('[cache] saved cache/last.html');

  // 解析
  const snap = parseEvaluateHtml(html);
  const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[parse] ${snap.categories.length} categories, ${total} items @ ${snap.snapshotTime}`);

  if (total === 0) {
    console.warn('[warn] 解析到 0 筆商品。');
    console.warn('[warn] 請看上面的 [diag] 和 [parse-diag] 輸出判斷原因。');
    console.warn('[warn] 如果 <select> 數量是 0，代表 HTML 根本沒有商品（被擋或抓到錯誤頁）。');
    console.warn('[warn] 如果 <select> 數量 > 0 但 option 是 0，代表商品是動態載入。');
  }

  await saveSnapshot(snap);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
