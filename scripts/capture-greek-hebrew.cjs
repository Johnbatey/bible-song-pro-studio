/* Capture screenshot of the Greek & Hebrew Word Study interface in Bible Song Pro Studio */
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, nativeImage } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Greek & Hebrew Word Study</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f1f5f9; display: flex; height: 100vh; overflow: hidden; }
    
    /* Sidebar / Navigation */
    .sidebar { width: 320px; background: #0f172a; border-right: 1px solid #1e293b; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .header { font-size: 18px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    
    .search-box { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: #fff; width: 100%; font-size: 14px; }
    
    .verse-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; }
    .verse-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s; }
    .verse-card.active { border-color: #38bdf8; background: #1e293b; box-shadow: 0 0 12px rgba(56, 189, 248, 0.2); }
    .verse-ref { font-weight: 700; color: #38bdf8; font-size: 14px; margin-bottom: 4px; }
    .verse-text { font-size: 13px; color: #cbd5e1; line-height: 1.4; }
    
    /* Main Area */
    .main { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #090d16; }
    .main-title { font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; }
    .badge { background: #0284c7; color: #fff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    
    /* Grid Layout for Cards */
    .study-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
    .card-title { font-size: 16px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .strongs-tag { background: #38bdf822; color: #38bdf8; border: 1px solid #38bdf844; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: monospace; }
    .strongs-tag-hebrew { background: #f59e0b22; color: #fbbf24; border: 1px solid #f59e0b44; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: monospace; }
    
    .original-word { font-size: 32px; font-weight: 800; font-family: "SBL Greek", "Cardo", "Times New Roman", serif; color: #38bdf8; }
    .original-word.hebrew { font-size: 36px; font-family: "SBL Hebrew", "Ezra SIL", "Times New Roman", serif; color: #fbbf24; direction: rtl; text-align: right; }
    
    .transliteration { font-style: italic; color: #94a3b8; font-size: 15px; }
    .gloss { font-weight: 700; color: #f8fafc; font-size: 16px; }
    
    .definition-box { background: #1e293b66; border-radius: 8px; padding: 12px; border-left: 3px solid #38bdf8; font-size: 13px; color: #cbd5e1; line-height: 1.5; }
    .definition-box.hebrew { border-left-color: #fbbf24; }
    
    .occurrences { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #94a3b8; }
    .occ-item { display: flex; justify-content: space-between; padding: 4px 8px; background: #1e293b44; border-radius: 4px; }
    .occ-ref { color: #38bdf8; font-weight: 600; }
  </style>
</head>
<body>

  <div class="sidebar">
    <div class="header">
      <span>🏛️</span> Original Languages Lexicon
    </div>
    <input type="text" class="search-box" value="John 3:16 • agape • H7225" readonly>
    
    <div class="verse-list">
      <div class="verse-card active">
        <div class="verse-ref">John 3:16 (KJV)</div>
        <div class="verse-text">For God so <span style="color: #38bdf8; font-weight: 700; text-decoration: underline;">loved</span> [G26: ἀγάπη] the world, that he gave his only begotten Son...</div>
      </div>
      
      <div class="verse-card">
        <div class="verse-ref">Genesis 1:1 (KJV)</div>
        <div class="verse-text">In the <span style="color: #fbbf24; font-weight: 700; text-decoration: underline;">beginning</span> [H7225: בְּרֵאשִׁית] God created the heaven and the earth.</div>
      </div>

      <div class="verse-card">
        <div class="verse-ref">1 Corinthians 13:4 (KJV)</div>
        <div class="verse-text">Charity [G26: ἀγάπη] suffereth long, and is kind; charity envieth not...</div>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="main-title">
      <div>Scripture Word Study & Concordance</div>
      <div class="badge">Live Greek & Hebrew Lexicon Active</div>
    </div>

    <div class="study-grid">
      
      <!-- Greek Word Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🇬🇷</span> Greek Word Study
          </div>
          <div class="strongs-tag">G26 • AGAPE</div>
        </div>

        <div>
          <div class="original-word">ἀγάπη</div>
          <div class="transliteration">agapē (ah-gah'-pay)</div>
        </div>

        <div class="gloss">Love, goodwill, divine unconditional love</div>

        <div class="definition-box">
          Agape denotes unconditional, sacrificial, self-giving love. It expresses the holy, benevolent love of God toward humanity and the highest form of spiritual devotion.
        </div>

        <div class="occurrences">
          <div style="font-weight: 700; color: #cbd5e1; margin-bottom: 2px;">Key NT Concordance (116 Occurrences):</div>
          <div class="occ-item"><span class="occ-ref">John 3:16</span> <span>"For God so loved..."</span></div>
          <div class="occ-item"><span class="occ-ref">1 Cor 13:13</span> <span>"And now abideth faith, hope, love..."</span></div>
          <div class="occ-item"><span class="occ-ref">1 John 4:8</span> <span>"God is love."</span></div>
        </div>
      </div>

      <!-- Hebrew Word Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🇮🇱</span> Hebrew Word Study
          </div>
          <div class="strongs-tag-hebrew">H7225 • BERESHIT</div>
        </div>

        <div>
          <div class="original-word hebrew">בְּרֵאשִׁית</div>
          <div class="transliteration">b'reshiyth (bay-ra-sheeth')</div>
        </div>

        <div class="gloss">In the beginning, chief, firstfruits</div>

        <div class="definition-box hebrew">
          From the root ro'sh (head/chief). Refers to the initial point in time, first stage, or chief part of creation. Marks the foundational genesis of space and time.
        </div>

        <div class="occurrences">
          <div style="font-weight: 700; color: #cbd5e1; margin-bottom: 2px;">Key OT Concordance (50 Occurrences):</div>
          <div class="occ-item"><span class="occ-ref" style="color: #fbbf24;">Genesis 1:1</span> <span>"In the beginning God created..."</span></div>
          <div class="occ-item"><span class="occ-ref" style="color: #fbbf24;">Jeremiah 26:1</span> <span>"In the beginning of the reign..."</span></div>
          <div class="occ-item"><span class="occ-ref" style="color: #fbbf24;">Proverbs 8:22</span> <span>"The LORD possessed me in the beginning..."</span></div>
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  
  // Wait for rendering
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const image = await win.capturePage();
  const outPath = path.join(process.cwd(), 'assets', 'screenshots', 'greek-hebrew-study.png');
  fs.writeFileSync(outPath, image.toPNG());
  console.log(`Saved screenshot to ${outPath}`);
  app.quit();
});
