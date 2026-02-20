# OpenClaw Tools Documentation

## 概述

本文檔詳細介紹了 OpenClaw 項目中開發的所有工具，包括 MCP 服務器、CRM 整合、DAV 服務、郵件管理和語音轉錄等功能。

## 工具列表

### 1. MCP 工具

#### mcp-call
統一的 MCP 服務器 CLI 橋接工具。

**位置：** `/root/.openclaw/tools/mcp-call.js`

**功能：**
- 整合多個 MCP 服務器（filesystem、brave、github、serper、zai_vision）
- 提供統一的 CLI 接口

**使用方法：**
```bash
mcp-call filesystem read_file /path/to/file
mcp-call brave brave_web_search "query"
mcp-call github search_issues "repo:owner/name query"
```

---

#### mcp-http-bridge
HTTP MCP 服務器橋接工具，用於連接 Z.ai 的 HTTP 服務器。

**位置：** `/root/.openclaw/tools/mcp-http-bridge.js`

**支援的服務器：**
- zai_search：網頁搜索
- zai_reader：網頁閱讀
- zai_zread：文檔搜索

---

### 2. 香港數據 MCP 服務器

#### hko-mcp-server / mcp-hko-bridge
香港天文台天氣數據 MCP 服務器。

**位置：**
- `/root/.openclaw/tools/hko-mcp-server.js`
- `/root/.openclaw/tools/mcp-hko-bridge.js`

**功能：**
- 本地天氣預報
- 9天天氣預報
- 當前天氣
- 天氣警告
- 地震信息

**使用方法：**
```bash
mcp-hko local-forecast
mcp-hko 9day-forecast
mcp-hko current-weather
```

---

#### hk-gov-mcp-server
香港政府開放數據 MCP 服務器。

**位置：** `/root/.openclaw/tools/hk-gov-mcp-server.js`

**功能：**
- 香港天文台天氣
- 運輸署交通速度
- 醫管局急症室輪候時間
- 九巴路線

**使用方法：**
```bash
hk-gov weather
hk-gov traffic
hk-gov hospital
hk-gov bus <route>
```

---

### 3. 股票數據

#### itick-mcp-server
iTick 股票數據 MCP 服務器。

**位置：** `/root/.openclaw/tools/itick-mcp-server.js`

**功能：**
- 股票代號搜索

**使用方法：**
```bash
itick search AAPL
```

---

### 4. WhatsApp CRM 工具

#### whatsapp-crm-cli
WhatsApp CRM 命令行工具。

**位置：** `/root/.openclaw/tools/whatsapp-crm-cli.js`

**功能：**
- 管理 WhatsApp sessions
- 查看聯繫人
- 發送訊息
- 查看訊息歷史

**使用方法：**
```bash
whatsapp-crm sessions
whatsapp-crm contacts <session_id>
whatsapp-crm messages <session_id> <jid>
whatsapp-crm send <session_id> <phone> <message>
```

---

#### whatsapp-voice-transcriber
自動轉錄 WhatsApp 語音訊息。

**位置：** `/root/.openclaw/tools/whatsapp-voice-transcriber.py`

**功能：**
- WebSocket 實時監聽
- 自動下載語音/視頻
- Whisper 轉錄（支援粵語、普通話、英文）
- 生成組合文件（音頻信息 + 轉錄文字）

**使用方法：**
```bash
# 啟動服務
/root/.openclaw/tools/start-voice-transcriber.sh

# 監控
tmux -S /tmp/openclaw-tmux-sockets/openclaw.sock attach -t whatsapp-voice
```

詳細文檔：[VOICE_TRANSCRIBER.md](./VOICE_TRANSCRIBER.md)

---

#### whatsapp-calendar-api-server
WhatsApp 日曆 API 服務器。

**位置：** `/root/.openclaw/tools/whatsapp-calendar-api-server.js`

**功能：**
- 掃描對話提取會議信息
- 生成 iCalendar 文件
- REST API 接口

---

### 5. DAV 服務器

#### openclaw-dav-server
CalDAV/CardDAV/WebDAV 服務器。

**位置：** `/root/.openclaw/tools/openclaw-dav-server.js`

**功能：**
- CalDAV 日曆同步
- CardDAV 聯繫人同步
- WebDAV 文件存儲
- HTTP API

**使用方法：**
```bash
openclaw-dav
```

**URL：**
- HTTP: `http://openclaw.techforliving.app:3080`
- HTTPS: `https://openclaw.techforliving.app`

---

### 6. 郵件管理

#### email-cli
郵件管理命令行工具。

**位置：** `/root/.openclaw/tools/email-cli.js`

**功能：**
- Gmail OAuth2 整合
- IMAP 郵箱管理
- 郵件搜索和過濾

---

### 7. 圖像生成

#### openrouter-image
使用 OpenRouter API 生成圖像。

**位置：** `/root/.openclaw/tools/openrouter-image.js`

**功能：**
- 通過 Gemini 3 Pro Image API 生成圖像

---

## 安裝所有工具

```bash
# 創建符號連結
ln -sf /root/.openclaw/tools/mcp-call.js /usr/local/bin/mcp-call
ln -sf /root/.openclaw/tools/mcp-http-bridge.js /usr/local/bin/mcp-http-bridge
ln -sf /root/.openclaw/tools/mcp-hko-bridge.js /usr/local/bin/mcp-hko
ln -sf /root/.openclaw/tools/hk-gov-cli.js /usr/local/bin/hk-gov
ln -sf /root/.openclaw/tools/itick-cli.js /usr/local/bin/itick
ln -sf /root/.openclaw/tools/whatsapp-crm-cli.js /usr/local/bin/whatsapp-crm
ln -sf /root/.openclaw/tools/openclaw-dav-server.js /usr/local/bin/openclaw-dav
ln -sf /root/.openclaw/tools/email-cli.js /usr/local/bin/email
ln -sf /root/.openclaw/tools/whatsapp-voice-transcriber.py /usr/local/bin/whatsapp-voice-transcriber
ln -sf /root/.openclaw/tools/whisper-transcribe.py /usr/local/bin/whisper-transcribe
```

## 環境變量

```bash
# API Keys
export BRAVE_API_KEY="..."
export GITHUB_PERSONAL_ACCESS_TOKEN="..."
export SERPER_API_KEY="..."
export Z_AI_API_KEY="..."
export OPENROUTER_API_KEY="..."
export ITICK_API_KEY="..."
```

## 目錄結構

```
/root/.openclaw/
├── tools/                    # 所有工具腳本
│   ├── mcp-*.js             # MCP 工具
│   ├── *-mcp-server.js      # MCP 服務器
│   ├── *-cli.js             # CLI 工具
│   ├── whatsapp-*.js        # WhatsApp 工具
│   ├── whatsapp-*.py        # WhatsApp Python 工具
│   ├── openclaw-dav-server.js
│   ├── whisper-*.py         # Whisper 轉錄工具
│   └── whisper-env/         # Python 虛擬環境
├── dav-data/                # DAV 服務器數據
│   ├── calendars/
│   ├── contacts/
│   └── files/
├── whatsapp-media/          # WhatsApp 媒體文件
│   ├── voice/               # 語音文件
│   └── transcripts/         # 轉錄結果
└── workspace/               # 工作區
    └── docs/                # 文檔
```

## 授權

MIT License
