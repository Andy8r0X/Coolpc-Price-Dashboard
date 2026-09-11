import * as cheerio from 'cheerio';

export function parseEvaluateHtml(html) {
  const $ = cheerio.load(html);

  const timeMatch = html.match(/估價時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const snapshotTime = timeMatch
    ? timeMatch[1].replace(/\//g, '-')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const categories = [];
  const seenNames = new Set();

  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const $catTd = $tr.children('td.t');
    if ($catTd.length === 0) return;

    const categoryName = $catTd.first().text().replace(/\s+/g, ' ').trim();
    if (!categoryName) return;

    const $select = $tr.find('select[name^="n"]').first();
    if ($select.length === 0) return;

    const items = [];

    $select.find('option').each((__, opt) => {
      const $opt = $(opt);

      if ($opt.attr('disabled') !== undefined) return;
      if ($opt.attr('class') === 'bf') return;

      const label = $opt.text().replace(/\s+/g, ' ').trim();
      const value = $opt.attr('value') || '';

      if (!label) return;
      if (label.startsWith('❤')) return;
      if (label.startsWith('↪')) return;
      if (label.startsWith('　　')) return;
      if (value === '0') return;

      const parsed = parseOptionLabel(label);
      if (!parsed) return;

      if (seenNames.has(parsed.name)) return;
      seenNames.add(parsed.name);

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
    }
  });

  return { snapshotTime, categories };
}

function parseOptionLabel(label) {
  if (!label) return null;

  let text = label.replace(/[★◆\s]+$/g, '').trim();

  const priceMatches = [...text.matchAll(/\$\s*([\d,]+)/g)];
  if (priceMatches.length === 0) return null;

  const lastMatch = priceMatches[priceMatches.length - 1];
  const price = parseInt(lastMatch[1].replace(/,/g, ''), 10);
  if (!Number.isFinite(price) || price <= 0) return null;

  let name = text.slice(0, lastMatch.index).trim();
  name = name.replace(/▼.*$/, '').trim();
  name = name.replace(/[,，\s]+$/, '').trim();

  if (!name || name.length < 2) return null;

  return { name, price };
}
