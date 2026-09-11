import * as cheerio from 'cheerio';

/**
 * 解析原價屋估價頁的 HTML
 * 商品在每個分類 <tr> 的 <select> 裡的 <option>
 */
export function parseEvaluateHtml(html) {
  const $ = cheerio.load(html);

  // ===== 解析診斷 =====
  console.log('[parse-diag] tr 總數:', $('tr').length);
  console.log('[parse-diag] td.t 總數:', $('td.t').length);
  console.log('[parse-diag] select 總數:', $('select').length);
  console.log('[parse-diag] select[name^="n"] 總數:', $('select[name^="n"]').length);
  console.log('[parse-diag] option 總數:', $('option').length);
  console.log('[parse-diag] optgroup 總數:', $('optgroup').length);

  // 前 3 個 td.t
  $('td.t').slice(0, 3).each((i, el) => {
    console.log(`[parse-diag] td.t[${i}]: "${$(el).text().slice(0, 60)}"`);
  });

  // 前 3 個 select
  $('select').slice(0, 3).each((i, el) => {
    const $sel = $(el);
    console.log(`[parse-diag] select[${i}] name=${$sel.attr('name')}, options=${$sel.find('option').length}`);
  });
  // ===== 診斷結束 =====

  // 抓估價時間
  const timeMatch = html.match(/估價時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const snapshotTime = timeMatch
    ? timeMatch[1].replace(/\//g, '-')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const categories = [];
  const seenNames = new Set();

  // 走訪每個分類 <tr>
  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const $catTd = $tr.children('td.t');
    if ($catTd.length === 0) return;

    const categoryName = $catTd.first().text().replace(/\s+/g, ' ').trim();
    if (!categoryName) return;

    // 找這個分類的 select
    const $select = $tr.find('select[name^="n"]').first();
    if ($select.length === 0) return;

    const items = [];

    // 走訪所有 <option>（包含在 <optgroup> 裡的）
    $select.find('option').each((__, opt) => {
      const $opt = $(opt);

      // 跳過：disabled、統計資訊（value=0 且有 class="bf"）
      if ($opt.attr('disabled') !== undefined) return;
      if ($opt.attr('class') === 'bf') return;

      const label = $opt.text().replace(/\s+/g, ' ').trim();
      const value = $opt.attr('value') || '';

      // 跳過提示訊息
      if (!label) return;
      if (label.startsWith('❤')) return;
      if (label.startsWith('↪')) return;
      if (label.startsWith('　　')) return;
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
        note: '',
        isHot,
        isPriceChanged,
      });
    });

    if (items.length > 0) {
      categories.push({ name: categoryName, items });
      console.log(`[parse-diag] 分類「${categoryName}」: ${items.length} 個商品`);
    }
  });

  console.log(`[parse-diag] 共 ${categories.length} 個分類有商品`);
  return { snapshotTime, categories };
}

/**
 * 從 option 文字抓出商品名與價格
 */
function parseOptionLabel(label) {
  if (!label) return null;

  // 移除尾端的符號（★ ◆ 空白）
  let text = label.replace(/[★◆\s]+$/g, '').trim();

  // 找價格：抓「最後一個」$ 後面的數字
  const priceMatches = [...text.matchAll(/\$\s*([\d,]+)/g)];
  if (priceMatches.length === 0) return null;

  const lastMatch = priceMatches[priceMatches.length - 1];
  const price = parseInt(lastMatch[1].replace(/,/g, ''), 10);
  if (!Number.isFinite(price) || price <= 0) return null;

  // 商品名：價格之前的所有文字
  let name = text.slice(0, lastMatch.index).trim();

  // 移除促銷字串
  name = name.replace(/▼.*$/, '').trim();
  name = name.replace(/[,，\s]+$/, '').trim();

  if (!name || name.length < 2) return null;

  return { name, price };
}
