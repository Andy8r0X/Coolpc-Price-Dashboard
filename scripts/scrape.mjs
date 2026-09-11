import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import iconv from 'iconv-lite';
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
  const contentType = res.headers.get('content-type') || '';
  console.log('[fetch] content-type:', contentType);

  // 用 arrayBuffer 抓原始 bytes
  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  console.log('[fetch] buffer bytes:', buf.length);

  // 從 content-type 判斷編碼
  let charset = 'utf-8';
  const m = contentType.match(/charset=([^;]+)/i);
  if (m) charset = m[1].trim().toLowerCase();
  console.log('[fetch] detected charset:', charset);

  // Big5 相關編碼統一用 big5 解
  let iconvCharset = charset;
  if (charset === 'big5' || charset === 'big5-hkscs' || charset === 'cp950') {
    iconvCharset = 'big5';
  }

  // 用 iconv-lite 解碼
  let html;
  try {
    html = iconv.decode(buf, iconvCharset);
    console.log('[fetch] iconv.decode OK with', iconvCharset);
  } catch (e) {
    console.warn('[fetch] iconv.decode failed:', e.message);
    console.warn('[fetch] falling back to utf-8');
    html = iconv.decode(buf, 'utf-8');
  }

  console.log('[fetch] HTML length (chars):', html.length);

  // 診斷
  console.log('[diag] 包含 <select:', html.includes('<select'));
  console.log('[diag] 包含 <option:', html.includes('<option'));
  console.log('[diag] 包含 RTX:', html.includes('RTX'));
  console.log('[diag] 包含 估價時間:', html.includes('估價時間'));
  console.log('[diag] 包含 處理器 CPU:', html.includes('處理器 CPU'));

  const optionCount = (html.match(/<option/g) || []).length;
  console.log('[diag] <option> 數量:', optionCount);

  // 印前 500 字，看中文正不正常
  console.log('[diag] HTML 前 500 字:');
  console.log(html.slice(0, 500));

  return html;
}

async function saveSnapshot(snap) {
  await writeFile(
    path.join(DOCS_DATA, 'latest.json'),
    JSON.stringify(snap),
    'utf8'
  );

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

  let html;
  try {
    html = await fetchHtml(URL);
  } catch (e) {
    console.warn('[fetch] primary failed:', e.message);
    console.warn('[fetch] trying fallback:', FALLBACK_URL);
    html = await fetchHtml(FALLBACK_URL);
  }

  await writeFile(path.join(CACHE, 'last.html'), html, 'utf8');
  console.log('[cache] saved cache/last.html');

  const snap = parseEvaluateHtml(html);
  const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[parse] ${snap.categories.length} categories, ${total} items @ ${snap.snapshotTime}`);

  if (total === 0) {
    console.warn('[warn] 解析到 0 筆商品。');
  }

  await saveSnapshot(snap);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
