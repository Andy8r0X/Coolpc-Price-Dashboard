import './globals.css';

export const metadata = {
  title: '原價屋價格儀表板',
  description: 'CoolPC 原價屋商品價格趨勢視覺化',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>
        <header className="site-header">
          <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`} className="brand">
            🖥️ 原價屋價格儀表板
          </a>
          <nav>
            <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>首頁</a>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <p>
            資料來源：原價屋估價系統（僅供參考，非官方）。
            歷史資料來自 Internet Archive。
          </p>
        </footer>
      </body>
    </html>
  );
}
