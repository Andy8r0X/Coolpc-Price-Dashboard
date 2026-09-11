async function fetchHtml() {
  console.log('[fetch] URL:', URL);

  const res = await fetch(URL, {
    headers: {
      'user-agent': UA,
      'accept-language': 'zh-TW,zh;q=0.9',
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
  console.log('[diag] 包含 RTX:', html.includes('RTX'));
  console.log('[diag] 包含 Ryzen:', html.includes('Ryzen'));
  console.log('[diag] 包含 估價時間:', html.includes('估價時間'));
  console.log('[diag] 包含 class="t":', html.includes('class="t"'));

  // 統計
  const selectCount = (html.match(/<select/g) || []).length;
  const optionCount = (html.match(/<option/g) || []).length;
  console.log('[diag] <select> 數量:', selectCount);
  console.log('[diag] <option> 數量:', optionCount);

  // 前 500 字
  console.log('[diag] HTML 前 500 字:');
  console.log(html.slice(0, 500));
  // ===== 診斷結束 =====

  await writeFile(path.join(CACHE, 'last.html'), html, 'utf8');
  console.log(`[fetch] saved cache/last.html (${html.length} bytes)`);
  return html;
}
