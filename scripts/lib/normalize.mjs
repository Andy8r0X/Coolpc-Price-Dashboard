/**
 * 把商品名稱轉成穩定的 key
 * 例如 "華碩 RTX4070 O12G GAMING" 和 "華碩 RTX 4070 O12G GAMING" 要對齊
 */
export function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]]/g, '')
    .replace(/[，,、]/g, '')
    .replace(/＄|\$|元/g, '')
    .trim();
}

/**
 * 從商品名稱猜分類（若爬蟲沒抓到分類時用）
 */
export function guessCategory(name) {
  const n = name.toUpperCase();
  if (/RTX|GTX|RX\s?\d|ARC\s?A/.test(n)) return '顯示卡VGA';
  if (/RYZEN|CORE\s?I|XEON|THREADRIPPER/.test(n)) return '處理器 CPU';
  if (/DDR[345]/.test(n)) return '記憶體 RAM';
  if (/SSD|M\.2|NVME/.test(n)) return '固態硬碟 M.2｜SSD';
  if (/HDD|NAS碟|企業碟/.test(n)) return '2.5/3.5 傳統內接硬碟HDD';
  if (/B[0-9]{3}|X[0-9]{3}|Z[0-9]{3}|A[0-9]{3}M/.test(n)) return '主機板 MB';
  if (/W\d{3,4}W|金牌|銅牌|白金/.test(n)) return '電源供應器';
  return '其他';
}

/**
 * 商品穩定 ID（用於 URL）
 */
export function makeId(name) {
  return Buffer.from(normalizeName(name)).toString('base64url').slice(0, 32);
}
