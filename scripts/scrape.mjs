import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(process.cwd());
const DOCS_DATA = path.join(ROOT, 'docs', 'data');
const CACHE = path.join(ROOT, 'cache');

const URL = 'https://ftp.coolpc.com.tw/evaluate.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function ensureDirs() {
  for (const d of [DOCS_DATA, CACHE]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }
}

async function fetchHtml() {
  console.log('[fetch]', URL);
  const res = await fetch(URL, {
    headers: { 'user-agent': UA, 'accept-language': 'zh-TW,zh;q=0.9' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  await writeFile(path.join(CACHE, 'last.html'), html, 'utf8');
  console.log(`[fetch] got ${html.length} bytes, saved cache/last.html`);
  return html;
}

/**
 * 解析 HTML
 * 目前主頁只有分類骨架，商品明細可能抓不到
 * 但我們先抓「所有看得到的商品列」——有些分類可能直接有資料
 */
function parse(html) {
  const $ = cheerio.load(html);

  const timeMatch = html.match(/估價時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const snapshotTime = timeMatch
    ? timeMatch[1].replace(/\//g, '-')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const categories = [];

  // 策略：找所有含有「單價」表頭的表格
  $('table').each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('tr').first().text();
    if (!/品\s*名|單\s*價/.test(headerText)) return;

    const items = [];
    $table.find('tr').each((__, tr) => {
      const tds = $(tr).children('td');
      if (tds.length < 5) return;

      const name = text($(tds[1]));
      if (!name || name.length < 2) return;
      if (/品\s*名|單\s*價/.test(name)) return;

      const price = parsePrice(text($(tds[4])));
      if (price === null) return;

      const rowHtml = $(tr).html() || '';
      items.push({
        name,
        price,
        note: text($(tds[6])),
        isHot: /color\s*=\s*["']?(red|#ff0000|#f00)/i.test(rowHtml),
        isPriceChanged: /color\s*=\s*["']?(green|#008000|#00[0-9a-f]{4})/i.test(rowHtml),
      });
    });

    if (items.length > 0) {
      categories.push({ name: '未分類', items });
    }
  });

  return { snapshotTime, categories };
}

function text($el) {
  if (!$el || $el.length === 0) return '';
  return $el.text().replace(/\s+/g, ' ').trim();
}

function parsePrice(s) {
  if (!s) return null;
  const m = String(s).replace(/,/g, '').match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function saveSnapshot(snap) {
  // 存一份 latest.json
  await writeFile(
    path.join(DOCS_DATA, 'latest.json'),
    JSON.stringify(snap),
    'utf8'
  );

  // 累積到 history.json（同一時間只留一天一筆）
  const historyFile = path.join(DOCS_DATA, 'history.json');
  let history = [];
  if (existsSync(historyFile)) {
    try {
      history = JSON.parse(await readFile(historyFile, 'utf8'));
    } catch {
      history = [];
    }
  }

  // 用 snapshotTime 去重
  history = history.filter((h) => h.snapshotTime !== snap.snapshotTime);
  history.push(snap);
  history.sort((a, b) => a.snapshotTime.localeCompare(b.snapshotTime));

  // 只保留最近 365 筆，避免檔案太大
  if (history.length > 365) history = history.slice(-365);

  await writeFile(historyFile, JSON.stringify(history), 'utf8');
  console.log(`[save] latest.json + history.json (${history.length} snapshots)`);
}

async function main() {
  await ensureDirs();
  const html = await fetchHtml();
  const snap = parse(html);
  const total = snap.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[parse] ${snap.categories.length} categories, ${total} items @ ${snap.snapshotTime}`);

  if (total === 0) {
    console.warn('[warn] 解析到 0 筆商品。');
    console.warn('[warn] 主頁 HTML 已存到 cache/last.html，請打開來看商品明細在哪。');
  }

  await saveSnapshot(snap);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
