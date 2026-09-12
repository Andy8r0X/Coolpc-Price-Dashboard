# 原價屋價格儀表板 (CoolPC Price Dashboard)

> 將原價屋線上估價系統的報價，轉換成**可視化**、**可搜尋**、**有價格趨勢**的儀表板。

🌐 **線上網址**：https://andy8r0x.github.io/Coolpc-Price-Dashboard/

---

## 功能特色

- 📊 **商品卡片**：顯示名稱、分類、價格、漲跌幅、迷你走勢圖
- 🔍 **即時搜尋**：輸入關鍵字立即篩選
- 🏷️ **分類篩選**：30 大分類
- 📈 **價格趨勢圖**：點擊卡片查看完整歷史價格
- 🔥 **熱賣 / 價格異動標記**
- 🌗 **深色 / 淺色主題**：預設淺色，可切換
- 🤖 **全自動更新**：GitHub Actions 每天自動抓取

---

## 資料來源

| 來源 | 說明 |
|------|------|
| **即時報價** | [原價屋線上估價系統](https://ftp.coolpc.com.tw/evaluate.php) |
| **歷史快照** | [Internet Archive](https://web.archive.org/web/*/http://www.coolpc.com.tw/evaluate.php) |

> ⚠️ 本專案僅供**個人研究**，資料版權歸原價屋所有，價格僅供參考。

---

## 技術架構

| 層次 | 技術 |
|------|------|
| 爬蟲 | Node.js + `fetch` + `iconv-lite`（Big5 編碼） |
| 解析 | `cheerio` |
| 前端 | 純 HTML + CSS + JS + ECharts |
| 部署 | GitHub Pages |
| 自動化 | GitHub Actions |

---

## 目錄結構

```
Coolpc-Price-Dashboard/
├── .github/workflows/
│   ├── update.yml          # 每日即時報價更新
│   └── archive.yml         # Archive.org 歷史快照
├── scripts/
│   ├── scrape.mjs          # 抓即時報價
│   ├── scrape-archive.mjs  # 抓 Archive.org
│   ├── process.mjs         # 合併資料
│   └── lib/parse.mjs       # 解析 HTML
├── docs/                   # GitHub Pages 根目錄
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data/
│       ├── products.json   # 商品清單
│       ├── trends.json     # 價格趨勢
│       └── prices/         # Archive 快照
└── package.json
```

---

## 本機開發

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

### 處理資料

```bash
npm run process
```

### 本機預覽

```bash
python3 -m http.server 8000 --directory docs
```

打開 `http://localhost:8000`。

---

## GitHub Actions

| Workflow | 觸發 | 說明 |
|----------|------|------|
| **Update CoolPC Dashboard** | 每天台灣 04:00 / 手動 | 抓當前報價 → 合併 → 部署 |
| **Fetch Archive.org Snapshots** | 手動 | 抓指定日期範圍的歷史快照 |

**手動觸發**：

```
Actions → 選擇 workflow → Run workflow
```

---

## 授權

**MIT License**。程式碼可自由使用、修改、散佈。

原價屋報價資料版權歸原價屋所有，本專案僅供個人研究，請勿用於商業用途。

---

**Made with Ai by [Andy8r0X](https://github.com/Andy8r0X)**
