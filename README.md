# ✦ 課堂即時翻譯平台

老師說話，學生即時看到翻譯。支援多語言同步廣播，動漫風格 UI。

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 API Key

建立 `.env` 檔案：

```
DEEPL_KEY=你的DeepL_API_Key
PORT=3001
```

> 免費申請：https://www.deepl.com/pro-api（每月 50 萬字免費）

### 3. 啟動 Server

```bash
npm start
```

### 4. 開啟介面

- **老師端**：用 Chrome 開啟 `teacher.html`
- **學生端**：用瀏覽器開啟 `student.html?session=XXXXXX`

---

## 📁 檔案結構

```
translate/
├── teacher.html    # 老師端（語音辨識 + WebSocket 送出）
├── student.html    # 學生端（接收翻譯 + 語音選擇）
├── server.js       # Node.js WebSocket 伺服器
├── package.json    # 依賴設定
└── README.md
```

## 🏗 架構

```
老師瀏覽器
  └── Web Speech API → 辨識中文
  └── WebSocket → 送出文字

Node.js Server
  ├── Room 管理（sessionId）
  ├── 語言追蹤（每個學生的目標語言）
  ├── 翻譯 Cache（省 API 費用）
  └── DeepL API → 翻譯

學生瀏覽器 × N
  ├── 選語言後加入房間
  ├── 即時接收翻譯文字
  └── 可選開啟語音朗讀
```

## 🌐 支援語言

越南文、印尼文、英文、日文、韓文、泰文、西班牙文、中文（繁/簡）

## 🚀 部署建議

- **Railway** 或 **Render**（支援 WebSocket 的 persistent connection）
- Vercel 不適用（無法保持 WebSocket 連線）

---

✦ Made with 💜 for multilingual classrooms
