// ============================================================
// 課堂即時翻譯 · Node.js WebSocket Server
// ============================================================
// 安裝依賴：npm install
// 啟動：    node server.js
// ============================================================

require('dotenv').config();
const http    = require('http');
const WebSocket = require('ws');
const fetch   = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const PORT = process.env.PORT || 3001;

// ── Room 管理 ─────────────────────────────────────────────
// roomId → { teacher: WebSocket | null, students: Map<WebSocket, langCode> }
const rooms = new Map();

// ── 翻譯 Cache ─────────────────────────────────────────────
// key: `${text}::${targetLang}` → translatedText
const translationCache = new Map();
const MAX_CACHE = 500;

// ── HTTP + WS Server ───────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('課堂翻譯 Server 運行中 ✦');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('session');
  const role      = url.searchParams.get('role');   // 'teacher' | 'student'
  const lang      = url.searchParams.get('lang') || 'en';

  if (!sessionId) { ws.close(4000, 'Missing session'); return; }

  // 確保 room 存在
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, { teacher: null, students: new Map() });
  }
  const room = rooms.get(sessionId);

  if (role === 'teacher') {
    room.teacher = ws;
    console.log(`[${sessionId}] 老師加入`);
  } else {
    room.students.set(ws, lang);
    console.log(`[${sessionId}] 學生加入 (lang: ${lang})，共 ${room.students.size} 人`);
  }

  // 通知老師目前連線人數
  broadcastCount(room);

  // ── 收到訊息（老師送出語音文字）───────────────────────
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type !== 'speech' || role !== 'teacher') return;
    const text = (msg.text || '').trim();
    if (!text) return;

    console.log(`[${sessionId}] 老師說：「${text}」`);

    // 取得房間內所有不重複目標語言
    const uniqueLangs = [...new Set(room.students.values())];

    // 對每種語言翻譯，再推送給對應學生
    await Promise.all(uniqueLangs.map(async (targetLang) => {
      const cacheKey = `${text}::${targetLang}`;
      let translated = translationCache.get(cacheKey);

      if (!translated) {
        try {
          translated = await translateDeepL(text, targetLang);
          // LRU-like: 超過上限時清掉最舊的
          if (translationCache.size >= MAX_CACHE) {
            translationCache.delete(translationCache.keys().next().value);
          }
          translationCache.set(cacheKey, translated);
        } catch (err) {
          console.error(`翻譯失敗 (${targetLang}):`, err.message);
          translated = `[翻譯失敗] ${text}`;
        }
      }

      // 推送給所有選了此語言的學生
      room.students.forEach((sLang, sWs) => {
        if (sLang === targetLang && sWs.readyState === WebSocket.OPEN) {
          sWs.send(JSON.stringify({
            type: 'translation',
            original: text,
            translated,
            lang: targetLang,
          }));
        }
      });

      console.log(`  → [${targetLang}] ${translated}`);
    }));
  });

  // ── 離線 ───────────────────────────────────────────────
  ws.on('close', () => {
    if (role === 'teacher') {
      room.teacher = null;
      console.log(`[${sessionId}] 老師離線`);
    } else {
      room.students.delete(ws);
      console.log(`[${sessionId}] 學生離線，剩 ${room.students.size} 人`);
    }
    broadcastCount(room);

    // 清空無人的 room
    if (!room.teacher && room.students.size === 0) {
      rooms.delete(sessionId);
      console.log(`[${sessionId}] Room 已清除`);
    }
  });

  ws.on('error', (err) => console.error('WS error:', err.message));
});

// ── 廣播連線人數給老師 ─────────────────────────────────────
function broadcastCount(room) {
  if (room.teacher && room.teacher.readyState === WebSocket.OPEN) {
    room.teacher.send(JSON.stringify({
      type: 'count',
      count: room.students.size,
    }));
  }
}

// ── DeepL 翻譯 API ─────────────────────────────────────────
async function translateDeepL(text, targetLang) {
  const DEEPL_KEY = process.env.DEEPL_KEY;
  if (!DEEPL_KEY) throw new Error('未設定 DEEPL_KEY 環境變數');

  // DeepL 語言代碼對應（部分語言需要特殊寫法）
  const DEEPL_LANG_MAP = {
    'zh-TW': 'ZH', 'zh-CN': 'ZH', 'zh': 'ZH',
    'en': 'EN', 'ja': 'JA', 'ko': 'KO',
    'vi': 'VI', 'id': 'ID', 'th': 'TH', 'es': 'ES',
  };

  const dl = DEEPL_LANG_MAP[targetLang] || targetLang.toUpperCase();

  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: 'ZH',      // 老師說中文
      target_lang: dl,
    }),
  });

  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
  const data = await res.json();
  return data.translations[0].text;
}

server.listen(PORT, () => {
  console.log(`✦ 課堂翻譯 Server 啟動於 port ${PORT}`);
  console.log(`  DeepL Key: ${process.env.DEEPL_KEY ? '✅ 已設定' : '❌ 未設定（請建立 .env）'}`);
});
