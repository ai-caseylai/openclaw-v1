# OpenClaw Voice Transcriber

## 概述

OpenClaw Voice Transcriber 是一個自動轉錄 WhatsApp 語音訊息的系統。它使用 OpenAI 的 Whisper 模型（通過 faster-whisper 實現）來即時轉錄收到的語音和視頻訊息，並將轉錄結果與音頻文件信息整合在一起。

## 主要功能

- **即時監聽**：通過 WebSocket 連接 WhatsApp CRM，實時接收新訊息
- **自動下載**：自動下載語音和視頻媒體文件
- **智能轉錄**：使用 Whisper small 模型，支援粵語、普通話、英文自動檢測
- **組合輸出**：生成包含音頻文件信息和轉錄文字的組合文件
- **多格式輸出**：同時生成 JSON、純文本和組合文件

## 系統架構

```
WhatsApp CRM (WebSocket)
         │
         ▼
whatsapp-voice-transcriber.py
         │
    ┌────┴────┐
    ▼         ▼
下載媒體    轉錄處理
    │         │
    ▼         ▼
voice/    transcripts/
.ogg      _combined.txt
          .json
          .txt
```

## 安裝

### 1. 創建 Python 虛擬環境

```bash
python3 -m venv /root/.openclaw/tools/whisper-env
source /root/.openclaw/tools/whisper-env/bin/activate
```

### 2. 安裝依賴

```bash
pip install faster-whisper websockets requests
```

### 3. 首次運行（下載模型）

```bash
/root/.openclaw/tools/whisper-setup.sh
```

這會自動下載 Whisper small 模型（約 466MB）。

## 使用方法

### 啟動服務

```bash
/root/.openclaw/tools/start-voice-transcriber.sh
```

或使用 tmux 直接啟動：

```bash
tmux new-session -d -s whatsapp-voice
source /root/.openclaw/tools/whisper-env/bin/activate
whatsapp-voice-transcriber
```

### 監控服務

```bash
# 連接 tmux session
tmux -S /tmp/openclaw-tmux-sockets/openclaw.sock attach -t whatsapp-voice

# 查看日誌
tmux -S /tmp/openclaw-tmux-sockets/openclaw.sock capture-pane -p -t whatsapp-voice:0.0 -S -100
```

### 停止服務

```bash
tmux -S /tmp/openclaw-tmux-sockets/openclaw.sock kill-session -t whatsapp-voice
```

## 輸出文件

### 1. 組合文件 (`{chat_id}_{message_id}_combined.txt`)

包含完整的音頻文件信息和轉錄文字：

```
============================================================
🎙️ 語音訊息轉錄
============================================================

📎 音頻文件: xxx.ogg
👤 發送者: [發送者名稱]
💬 聊天: [聊天ID]
🕐 時間: 2026-02-21 02:53:00
🌐 語言: yue (信心度: 95%)
⏱️ 時長: 15.3 秒
📁 文件位置: /root/.openclaw/whatsapp-media/voice/xxx.ogg

============================================================
📝 轉錄內容:
============================================================

[轉錄的文字內容...]

============================================================
🔚 結束
```

### 2. 純文本文件 (`{chat_id}_{message_id}.txt`)

簡潔格式，只包含發送者和轉錄內容：

```
[發送者名稱] 轉錄的文字內容...
```

### 3. JSON 文件 (`{chat_id}_{message_id}.json`)

完整的結構化數據：

```json
{
  "message_id": "...",
  "chat_id": "...",
  "sender_name": "...",
  "file": "...",
  "detected_language": "yue",
  "language_probability": 0.95,
  "duration": 15.3,
  "transcript": "...",
  "transcribed_at": "2026-02-21T02:53:00"
}
```

## 配置

編輯 `whatsapp-voice-transcriber.py` 中的 `CONFIG` 字典：

```python
CONFIG = {
    "ws_url": "wss://whatsapp-crm.techforliving.app/ws",  # WebSocket URL
    "api_base": "https://whatsapp-crm.techforliving.app",  # API 基礎 URL
    "session_id": "sess_1771472517677",  # WhatsApp session ID
    "download_dir": "/root/.openclaw/whatsapp-media/voice",  # 音頻下載目錄
    "transcript_dir": "/root/.openclaw/whatsapp-media/transcripts",  # 轉錄輸出目錄
    "model_size": "small",  # Whisper 模型大小
}
```

### 模型選項

- `tiny`：最快，準確度一般
- `base`：平衡
- `small`：較慢，準確度高（預設）
- `medium`：慢，很準確
- `large`：最慢，最準確

## 批次轉錄工具

對於現有的音頻/視頻文件，可以使用 `whisper-transcribe.py`：

```bash
# 轉錄單個文件
whisper-transcribe /path/to/audio.mp3

# 批次轉錄整個目錄
whisper-transcribe /path/to/audio/files -b

# 指定輸出位置
whisper-transcribe audio.mp3 -o /output/dir

# 使用不同模型
whisper-transcribe audio.mp3 -m medium
```

## 技術細節

### 支援的媒體格式

- 音頻：`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`
- 視頻：`.mp4`, `.webm`, `.mov`

### 語言檢測

Whisper 自動檢測語言，支援：
- 粵語 (`yue`)
- 普通話 (`zh`)
- 英文 (`en`)
- 其他 90+ 種語言

### 性能

- Small 模型在 CPU 上處理 1 分鐘音頻約需 10-15 秒
- 使用 GPU 可加速 5-10 倍

## 故障排除

### WebSocket 連接失敗

檢查 WhatsApp CRM 服務是否運行：
```bash
whatsapp-crm status sess_1771472517677
```

### 模型下載失敗

手動下載模型：
```bash
source /root/.openclaw/tools/whisper-env/bin/activate
python3 -c "from faster_whisper import WhisperModel; WhisperModel('small')"
```

### 轉錄品質不佳

嘗試使用更大的模型：
```python
CONFIG["model_size"] = "medium"  # 或 "large"
```

## 文件結構

```
/root/.openclaw/
├── tools/
│   ├── whatsapp-voice-transcriber.py    # 主轉錄腳本
│   ├── whisper-transcribe.py            # 批次轉錄工具
│   ├── whisper-setup.sh                 # 設置腳本
│   ├── start-voice-transcriber.sh       # 啟動腳本
│   └── whisper-env/                     # Python 虛擬環境
├── whatsapp-media/
│   ├── voice/                           # 下載的音頻文件
│   └── transcripts/                     # 轉錄結果
└── workspace/
    └── docs/
        └── VOICE_TRANSCRIBER.md         # 本文檔
```

## 授權

MIT License

## 作者

OpenClaw Project
