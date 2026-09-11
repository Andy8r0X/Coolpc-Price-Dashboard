import * as cheerio from 'cheerio';

/**
 * 解析原價屋 evaluate.php 的 HTML
 * 回傳 { snapshotTime, categories: [{ name, items: [...] }] }
 */
export function parseEvaluateHtml(html) {
  const $ = cheerio.load(html);

  // 1. 抓估價時間
  const timeMatch = html.match(/估價時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const snapshotTime = timeMatch
    ? timeMatch[1].replace(/\//g, '-')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const categories = [];

  // 2. 原價屋的估價表主結構：table 內每個分類是一個 tr
  //    分類名稱在 <td class="t"> 或第一個 td，商品在該 tr 內的子表格
  $('table').first().children('tbody').children('tr').each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.children('td');
    if (tds.length < 2) return;

    // 分類名稱：通常在第二個 td 或帶有 bgcolor 的 td
    const categoryName = cleanText($(tds[1]).text());
    if (!categoryName) return;

    // 跳過沒有商品的分類（只有篩選條件的）
    const items = [];

    // 3. 商品列可能在這個 tr 內的子表格，或下一個 tr
    //    原價屋常見結構：商品在 <table class="..."> 內的 <tr>，每列 7 個 td
    $tr.find('table tr').each((__, subTr) => {
      const $sub = $(subTr);
      const subTds = $sub.children('td');
      if (subTds.length < 5) return;

      const name = cleanText($(subTds[1]).text());
      if (!name || name.length < 2) return;

      const priceText = cleanText($(subTds[4]).text());
      const price = parsePrice(priceText);
      if (price === null) return;

      // 價格異動標記：原價屋用顏色，HTML 上可能是 <font color="...">
      const rowHtml = $sub.html() || '';
      const isPriceChanged = /color\s*=\s*["']?(green|#00[0-9a-f]{4}|#008000)/i.test(rowHtml);
      const isHot = /color\s*=\s*["']?(red|#ff0000|#f00)/i.test(rowHtml);

      // 備註欄
      const note = cleanText($(subTds[6]?.text?.() || ''));

      items.push({
        name,
        price,
        note,
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

function cleanText(s) {
  if (s === null || s === undefined) return '';
  // 若傳進來是 cheerio 物件或 DOM 節點，先轉成字串
  if (typeof s === 'object') {
    if (typeof s.text === 'function') {
      try { s = s.text(); } catch { s = ''; }
    } else if (typeof s.toString === 'function') {
      s = s.toString();
    } else {
      s = '';
    }
  }
  return String(s).replace(/\s+/g, ' ').trim();
}

function parsePrice(s) {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
