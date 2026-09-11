import * as cheerio from 'cheerio';

/**
 * 解析原價屋估價頁的 HTML
 * 商品在每個分類 <tr> 的 <select> 裡的 <option>
 */
export function parseEvaluateHtml(html) {
  const $ = cheerio.load(html);

  // 抓估價時間
  const timeMatch = html.match(/估價時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const snapshotTime = timeMatch
    ? timeMatch[1].replace(/\//g, '-')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const categories = [];
  const seenNames = new Set(); // 去重

  // 走訪每個分類 <tr>
  // 分類特徵：有 <td class="t"> 且裡面有 <select name="nX">
  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const $catTd = $tr.children('td.t');
    if ($catTd.length === 0) return;

    const categoryName = cleanText($catTd.first());
    if (!categoryName) return;

    // 找這個分類的 select
    const $select = $tr.find('select[name^="n"]').first();
    if ($select.length === 0) return;

    const items = [];

    // 走訪所有 <option>（包含在 <optgroup> 裡的）
    $select.find('option').each((__, opt) => {
      const $opt = $(opt);

      // 跳過：disabled、統計資訊（value=0 且有 class="bf"）、空選項
      if ($opt.attr('disabled') !== undefined) return;
      if ($opt.attr('class') === 'bf') return;

      const label = cleanText($opt);
      const value = $opt.attr('value') || '';

      // 跳過提示訊息（❤ 開頭、↪ 開頭、value=0 的統計）
      if (!label) return;
      if (label.startsWith('❤')) return;
      if (label.startsWith('↪')) return;
      if (label.startsWith('　　')) return; // 全形空白開頭的提示
      if (value === '0') return;

      // 解析商品名與價格
      const parsed = parseOptionLabel(label);
      if (!parsed) return;

      // 去重
      if (seenNames.has(parsed.name)) return;
      seenNames.add(parsed.name);

      // 判斷顏色標記
      const cls = $opt.attr('class') || '';
      const isHot = cls.includes('r') || cls.includes('b');
      const isPriceChanged = cls.includes('g') || cls.includes('b');

      items.push({
        name: parsed.name,
        price: parsed.price,
        note: parsed.note || '',
        isHot,
        isPriceChanged,
      });
    });

    if (items.length > 0) {
      categories.push({ name: categoryName, items });
    }
  });

  return { snapshotTime, categories };
}

/**
 * 從 option 文字抓出商品名與價格
 *
 * 範例：
 *   "ASUS Ascent QSFP 連接線【現貨】, $3990 ★"
 *   "ASUS Ascent GX10 GB10 / 128G / Gen4 1TB SSD【現貨】, $175900 ◆ ★"
 *   "i5-13420H / 16G / 1T / WIN11 / 5060 / 330W電供▼下殺到 9/20 23:59, $46990↘$39990 ◆ ★"
 *   "DELL Base Ryzen AI 7 350/16G/512G/14吋 銀｛DC14255-R1808STW｝▼下殺到 9/15 23:59, $45990↘$40999 ◆ ★"
 */
function parseOptionLabel(label) {
  if (!label) return null;

  // 移除尾端的符號（★ ◆ 空白）
  let text = label.replace(/[★◆\s]+$/g, '').trim();

  // 找價格：抓「最後一個」$ 後面的數字
  // 因為特價商品格式是 $原價↘$特價，我們要取最後一個
  const priceMatches = [...text.matchAll(/\$\s*([\d,]+)/g)];
  if (priceMatches.length === 0) return null;

  const lastMatch = priceMatches[priceMatches.length - 1];
  const price = parseInt(lastMatch[1].replace(/,/g, ''), 10);
  if (!Number.isFinite(price) || price <= 0) return null;

  // 商品名：價格之前的所有文字
  let name = text.slice(0, lastMatch.index).trim();

  // 移除「▼下殺到 ...」這類的促銷字串
  name = name.replace(/▼.*$/, '').trim();

  // 移除尾端的逗號、空白
  name = name.replace(/[,，\s]+$/, '').trim();

  if (!name || name.length < 2) return null;

  return { name, price };
}

function cleanText($el) {
  if (!$el || $el.length === 0) return '';
  return $el.text().replace(/\s+/g, ' ').trim();
}
