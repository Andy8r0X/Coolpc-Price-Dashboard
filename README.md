# 原價屋價格儀表板 (CoolPC Price Dashboard)

> 將原價屋線上估價系統的報價，轉換成**可視化**、**可搜尋**、**有價格趨勢**的儀表板。

🌐 **線上網址**：https://andy8r0x.github.io/Coolpc-Price-Dashboard/

---

## 專案簡介

這是一個**純靜態**的價格追蹤儀表板，資料來自：

- **即時報價**：原價屋線上估價系統（每日自動抓取）
- **歷史價格**：Internet Archive（Wayback Machine）的歷史快照

所有資料以 JSON 形式存在 `docs/data/`，前端是純 HTML + JavaScript，部署在 **GitHub Pages** 上，**零成本**、**全自動**。

---

## 功能特色

- 📊 **商品卡片網格**：顯示商品名稱、分類、價格、漲跌幅、迷你走勢圖
- 🔍 **即時搜尋**：輸入關鍵字立即篩選
- 🏷️ **分類篩選**：30 大分類（CPU、主機板、記憶體、顯示卡…）
- 📈 **價格趨勢圖**：點擊商品卡片，查看完整歷史價格折線圖
- 🔥 **熱賣 / 價格異動標記**：一眼看出哪些商品正在變動
- 🌗 **深色 / 淺色主題**：預設淺色，可切換，選擇會記住
- 🤖 **全自動更新**：GitHub Actions 每天自動抓取最新報價

---

## 技術架構

```
┌──────────────────────────────────────────────────────────────┐
│                    GitHub Actions (排程觸發)                   │
│                                                              │
│  cron: 每天 UTC 20:00（台灣時間 04:00）                        │
│    │                                                         │
│    ├─ npm run scrape        抓即時報價 → history.json        │
│    ├─ npm run process       合併資料 → products.json         │
│    │                                  → trends.json          │
│    └─ commit & push → main                                   │
│                                                              │
│  手動觸發：                                                   │
│    └─ Fetch Archive.org Snapshots → prices/YYYY-MM.json      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   GitHub Pages         │
              │   (靜態網站 + JSON)     │
              │   andy8r0x.github.io   │
              └────────────────────────┘
```

**核心技術**：

| 層次 | 技術 |
|------|------|
| 爬蟲 | Node.js + `fetch` + `iconv-lite`（處理 Big5 編碼） |
| 解析 | `cheerio`（解析 `<option>` 裡的商品） |
| 資料處理 | Node.js（時間序列、壓縮、ID 生成） |
| 前端 | 純 HTML + CSS + JavaScript + ECharts |
| 部署 | GitHub Pages（從 `main` 的 `docs/`） |
| 自動化 | GitHub Actions |

---

## 目錄結構

```
Coolpc-Price-Dashboard/
├── .github/
│   └── workflows/
│       ├── update.yml          # 每日即時報價更新
│       └── archive.yml         # Archive.org 歷史快照
├── scripts/
│   ├── scrape.mjs              # 抓即時報價
│   ├── scrape-archive.mjs      # 抓 Archive.org
│   ├── process.mjs             # 合併資料、產生 products/trends
│   └── lib/
│       └── parse.mjs           # 解析原價屋 HTML
├── docs/                       # GitHub Pages 根目錄
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data/
│       ├── latest.json         # 最新快照
│       ├── history.json        # 每日即時快照累積
│       ├── products.json       # 商品清單（首頁用）
│       ├── trends.json         # 價格趨勢（詳情頁用）
│       ├── meta.json           # 統計資訊
│       └── prices/
│           ├── 2024-01.json    # Archive 快照（每月一檔）
│           ├── 2024-02.json
│           └── ...
├── package.json
└── README.md
```

---

## 資料來源

| 來源 | 說明 |
|------|------|
| **即時報價** | [原價屋線上估價系統](https://ftp.coolpc.com.tw/evaluate.php) |
| **歷史快照** | [Internet Archive Wayback Machine](https://web.archive.org/web/*/http://www.coolpc.com.tw/evaluate.php) |

> ⚠️ **免責聲明**：本專案僅供**個人研究**使用，資料版權歸原價屋所有。價格僅供參考，**不保證與官方同步**，實際交易請以原價屋官網為準。

---

## 本機開發

### 環境需求

- **Node.js** 18 以上（建議 22）
- **npm**

### 安裝

```bash
git clone https://github.com/Andy8r0X/Coolpc-Price-Dashboard.git
cd Coolpc-Price-Dashboard
npm install
```

### 抓即時報價

```bash
npm run scrape
```

跑完後 `docs/data/latest.json` 和 `docs/data/history.json` 會更新。

### 處理資料

```bash
npm run process
```

跑完後 `docs/data/products.json`、`trends.json`、`meta.json` 會更新。

### 本機預覽

```bash
# 用 Python 內建 http server
python3 -m http.server 8000 --directory docs

# 或 npm 套件
npx serve docs
```

打開 `http://localhost:8000` 就能看到儀表板。

---

## GitHub Actions

### 1. 每日即時報價更新（`update.yml`）

- **觸發**：每天 UTC 20:00（台灣 04:00）自動跑，或手動觸發
- **動作**：抓當前報價 → 合併資料 → commit → Pages rebuild

**手動觸發**：

```
Actions → Update CoolPC Dashboard → Run workflow
```

### 2. Archive.org 歷史快照（`archive.yml`）

- **觸發**：手動觸發
- **動作**：從 CDX API 查詢指定日期範圍的快照 → 抓取 → 解析 → 存到 `prices/`

**手動觸發**：

```
Actions → Fetch Archive.org Snapshots → Run workflow
  start: 20240101
  end:   20260930
```

> 💡 **增量模式**：`Update CoolPC Dashboard` 每天自動跑，`history.json` 會自動累積。Archive 快照需要手動觸發，指定日期範圍。

---

## 資料格式

### `products.json`（首頁用）

```json
[
  {
    "id": "aBcDeFgHiJkLmNoPqRsTuV",
    "name": "ASUS Ascent QSFP 連接線【現貨】",
    "category": "品牌小主機、AIO｜VR虛擬",
    "price": 3990,
    "change": 0,
    "changePct": 0,
    "min": 3990,
    "max": 3990,
    "snapshotTime": "2026-09-12 06:51:47",
    "spark": [3990, 3990, 3990, 3950, 3950]
  }
]
```

### `trends.json`（詳情頁用）

```json
[
  {
    "id": "aBcDeFgHiJkLmNoPqRsTuV",
    "name": "ASUS Ascent QSFP 連接線【現貨】",
    "category": "品牌小主機、AIO｜VR虛擬",
    "current": 3990,
    "min": 3950,
    "max": 3990,
    "change": -40,
    "changePct": -1.0,
    "points": [
      { "t": "2026-08-04 06:34:56", "p": 3990 },
      { "t": "2026-08-10 17:26:32", "p": 3950 },
      { "t": "2026-08-18 12:50:36", "p": 3990 }
    ],
    "rawPointCount": 212
  }
]
```

### `meta.json`（統計資訊）

```json
{
  "generatedAt": "2026-09-12T06:51:47.000Z",
  "snapshotCount": 212,
  "productCount": 6500,
  "latestSnapshot": "2026-09-12 06:51:47",
  "earliestSnapshot": "2024-01-20 03:49:51"
}
```

---

## 自訂主題

在 `docs/style.css` 最上方調整 CSS 變數即可：

```css
/* 淺色（預設） */
:root {
  --bg: #f7f8fa;
  --panel: #ffffff;
  --text: #1a1d24;
  --accent: #2563eb;
  --up: #d93025;
  --down: #137333;
}

/* 深色 */
[data-theme="dark"] {
  --bg: #0f1115;
  --panel: #171a21;
  --text: #e6e8ee;
  --accent: #4a9eff;
  --up: #ff5c5c;
  --down: #3ddc84;
}
```

---

## 常見問題

### Q：資料多久更新一次？

**每天一次**。GitHub Actions 在台灣時間凌晨 4 點自動跑。

### Q：可以手動更新嗎？

可以。到 **Actions** → **Update CoolPC Dashboard** → **Run workflow**。

### Q：為什麼有些商品趨勢圖是直線？

代表該商品在**追蹤期間內價格沒有變動**，或該商品**只出現在少數快照**。這是正常現象。

### Q：如何補更多歷史資料？

到 **Actions** → **Fetch Archive.org Snapshots** → **Run workflow**，指定更早的日期範圍（例如 `20200101`）。

### Q：網站載入很慢怎麼辦？

`trends.json` 可能太大。可以修改 `process.mjs` 的 `MIN_CHANGE_PCT` 參數，只保留價格變動超過一定比例的點。

### Q：可以改成追蹤其他網站嗎？

可以。修改 `scripts/scrape.mjs` 的 URL 與 `scripts/lib/parse.mjs` 的解析邏輯即可。

---

## 授權

本專案採用 **MIT License**。程式碼可自由使用、修改、散佈。

**但請注意**：

- 原價屋的報價資料**版權歸原價屋所有**
- 本專案僅供**個人研究**，請勿用於商業用途
- 請勿高頻率爬取，以免造成對方伺服器負擔

---

## 貢獻

歡迎開 Issue 或 Pull Request。

如果有改進建議，請在 Issue 中說明：

1. 你遇到的問題
2. 預期的行為
3. 重現步驟（如果適用）

---

## 致謝

- [原價屋](https://www.coolpc.com.tw/) 提供公開報價
- [Internet Archive](https://archive.org/) 提供歷史快照
- [ECharts](https://echarts.apache.org/) 提供圖表
- [cheerio](https://cheerio.js.org/) 提供 HTML 解析
- [iconv-lite](https://github.com/ashtuchkin/iconv-lite) 處理 Big5 編碼

---

**Made with ❤️ by [Andy8r0X](https://github.com/Andy8r0X)**
