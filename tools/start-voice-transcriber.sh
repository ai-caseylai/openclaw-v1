#!/bin/bash
# start-voice-transcriber.sh - 啟動 WhatsApp 語音轉錄服務

SOCKET_DIR="${OPENCLAW_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/openclaw-tmux-sockets}"
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/openclaw.sock"
SESSION="whatsapp-voice"

# 檢查是否已存在
if tmux -S "$SOCKET" has-session -t "$SESSION" 2>/dev/null; then
    echo "⚠️ 轉錄服務已在運行中"
    echo ""
    echo "查看狀態:"
    echo "  tmux -S \"$SOCKET\" attach -t \"$SESSION\""
    echo ""
    echo "停止服務:"
    echo "  tmux -S \"$SOCKET\" kill-session -t \"$SESSION\""
    exit 0
fi

# 創建新 session
tmux -S "$SOCKET" new-session -d -s "$SESSION" -n transcriber

# 啟動轉錄器
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 "source /root/.openclaw/tools/whisper-env/bin/activate" Enter
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 "whatsapp-voice-transcriber" Enter

echo "🎙️ WhatsApp 語音轉錄服務已啟動!"
echo ""
echo "監控命令:"
echo "  tmux -S \"$SOCKET\" attach -t \"$SESSION\""
echo ""
echo "查看日誌:"
echo "  tmux -S \"$SOCKET\" capture-pane -p -t \"$SESSION\":0.0 -S -100"
echo ""
echo "停止服務:"
echo "  tmux -S \"$SOCKET\" kill-session -t \"$SESSION\""
echo ""
echo "📁 輸出位置:"
echo "  音頻: /root/.openclaw/whatsapp-media/voice/"
echo "  轉錄: /root/.openclaw/whatsapp-media/transcripts/"
