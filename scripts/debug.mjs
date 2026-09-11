import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const URL = 'https://ftp.coolpc.com.tw/evaluate.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

console.log('=== 1. 抓取 HTML ===');
const res = await fetch(URL, {
  headers: {
    'user-agent': UA,
    'accept-language': 'zh-TW,zh;q=0.9',
    'referer': 'https://www.coolpc.com.tw/',
  },
});
console.log('HTTP status:', res.status);
console.log('content-type:', res.headers.get('content-type'));

const html = await res.text();
console.log('HTML 長度:', html.length);

// 存到 debug-output.html（在專案根目錄）
await writeFile('debug-output.html', html, 'utf8');
console.log('已存到 debug-output.html');

console.log('\n=== 2. 關鍵字出現次數 ===');
for (const kw of ['<select', '<option', 'optgroup', 'RTX', 'Ryzen', 'Intel', 'class="t"', '估價時間']) {
  const count = (html.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(`  ${kw}: ${count}`);
}

console.log('\n=== 3. HTML 前 500 字 ===');
console.log(html.slice(0, 500));

console.log('\n=== 4. cheerio 解析 ===');
const $ = cheerio.load(html);
console.log('tr 總數:', $('tr').length);
console.log('td.t 總數:', $('td.t').length);
console.log('select[name^="n"] 總數:', $('select[name^="n"]').length);
console.log('option 總數:', $('option').length);

console.log('\n=== 5. 前 3 個 select[name^="n"] ===');
$('select[name^="n"]').slice(0, 3).each((i, el) => {
  const $sel = $(el);
  console.log(`  select[${i}] name=${$sel.attr('name')}, options=${$sel.find('option').length}`);
  $sel.find('option').slice(0, 3).each((j, opt) => {
    const $opt = $(opt);
    console.log(`    option[${j}] value=${$opt.attr('value')} class=${$opt.attr('class')} text="${$opt.text().slice(0, 80)}"`);
  });
});

console.log('\n=== 6. 前 5 個 td.t ===');
$('td.t').slice(0, 5).each((i, el) => {
  console.log(`  td.t[${i}]: "${$(el).text().slice(0, 60)}"`);
});
