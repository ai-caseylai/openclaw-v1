#!/usr/bin/env python3
"""
whatsapp-voice-transcriber.py - 自動轉錄 WhatsApp 語音訊息
監控新訊息，自動下載並轉錄語音/視頻，並將文字加插在語音文件下方
"""

import os
import sys
import json
import time
import asyncio
import websockets
import requests
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

# 將 whisper 環境加入路徑
sys.path.insert(0, '/root/.openclaw/tools/whisper-env/lib/python3.12/site-packages')

from faster_whisper import WhisperModel

# 配置
CONFIG = {
    "ws_url": "wss://whatsapp-crm.techforliving.app/ws",
    "api_base": "https://whatsapp-crm.techforliving.app",
    "session_id": "sess_1771472517677",
    "download_dir": "/root/.openclaw/whatsapp-media/voice",
    "transcript_dir": "/root/.openclaw/whatsapp-media/transcripts",
    "model_size": "small",
    "processed_messages": set()  # 已處理的訊息ID
}

# 載入 Whisper 模型（全域只載入一次）
print("🎙️ 載入 Whisper 模型...")
whisper_model = None

def load_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = WhisperModel(
            CONFIG["model_size"], 
            device="auto", 
            compute_type="int8"
        )
    return whisper_model

def ensure_dirs():
    """確保目錄存在"""
    Path(CONFIG["download_dir"]).mkdir(parents=True, exist_ok=True)
    Path(CONFIG["transcript_dir"]).mkdir(parents=True, exist_ok=True)

def download_media(message_id, media_url, chat_id):
    """下載媒體文件"""
    try:
        # 從 URL 提取文件擴展名
        parsed = urlparse(media_url)
        ext = Path(parsed.path).suffix or '.ogg'
        
        filename = f"{chat_id}_{message_id}{ext}"
        filepath = Path(CONFIG["download_dir"]) / filename
        
        print(f"📥 下載媒體: {filename}")
        
        response = requests.get(media_url, timeout=60, verify=False)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ 已下載: {filepath}")
        return filepath
        
    except Exception as e:
        print(f"❌ 下載失敗: {e}")
        return None

def transcribe_audio(filepath, chat_id, message_id, sender_name=""):
    """轉錄音頻文件"""
    try:
        model = load_model()
        
        print(f"🎙️ 正在轉錄: {filepath.name}")
        
        segments, info = model.transcribe(
            str(filepath),
            language=None,  # 自動檢測
            task="transcribe",
            vad_filter=True,
            condition_on_previous_text=True
        )
        
        # 收集轉錄文本
        transcript_parts = []
        for segment in segments:
            transcript_parts.append(segment.text.strip())
        
        full_transcript = " ".join(transcript_parts)
        
        # 保存結果
        result = {
            "message_id": message_id,
            "chat_id": chat_id,
            "sender_name": sender_name,
            "file": str(filepath),
            "detected_language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "transcript": full_transcript,
            "transcribed_at": datetime.now().isoformat()
        }
        
        # 保存 JSON
        transcript_file = Path(CONFIG["transcript_dir"]) / f"{chat_id}_{message_id}.json"
        with open(transcript_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        # 創建組合文件（語音文件 + 轉錄文字）
        combined_file = Path(CONFIG["transcript_dir"]) / f"{chat_id}_{message_id}_combined.txt"
        with open(combined_file, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("🎙️ 語音訊息轉錄\n")
            f.write("=" * 60 + "\n\n")
            
            f.write(f"📎 音頻文件: {filepath.name}\n")
            f.write(f"👤 發送者: {sender_name or 'Unknown'}\n")
            f.write(f"💬 聊天: {chat_id}\n")
            f.write(f"🕐 時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"🌐 語言: {info.language} (信心度: {info.language_probability:.2%})\n")
            f.write(f"⏱️ 時長: {info.duration:.1f} 秒\n")
            f.write(f"📁 文件位置: {filepath}\n")
            f.write("\n" + "=" * 60 + "\n")
            f.write("📝 轉錄內容:\n")
            f.write("=" * 60 + "\n\n")
            f.write(full_transcript)
            f.write("\n\n" + "=" * 60 + "\n")
            f.write("🔚 結束\n")
        
        # 同時保存純文本（只有轉錄內容）
        text_file = Path(CONFIG["transcript_dir"]) / f"{chat_id}_{message_id}.txt"
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(f"[{sender_name or 'Unknown'}] ")
            f.write(full_transcript)
        
        print(f"✅ 轉錄完成!")
        print(f"   語言: {info.language}")
        print(f"   內容: {full_transcript[:100]}...")
        
        return result
        
    except Exception as e:
        print(f"❌ 轉錄失敗: {e}")
        return None

async def send_transcript_to_chat(chat_id, transcript, sender_name):
    """將轉錄結果發送回 WhatsApp 聊天（可選功能）"""
    try:
        # 這裡可以實現將轉錄結果發送回 WhatsApp
        # 需要調用 CRM API 發送訊息
        print(f"📤 可將轉錄結果發送至: {chat_id}")
        print(f"   內容預覽: {transcript[:50]}...")
        # TODO: 實現發送功能
        pass
    except Exception as e:
        print(f"⚠️ 發送轉錄結果失敗: {e}")

async def process_message(message_data):
    """處理單個訊息"""
    try:
        msg_type = message_data.get('type')
        
        # 只處理新訊息
        if msg_type != 'new_message':
            return
        
        message = message_data.get('message', {})
        message_id = message.get('message_id') or message.get('id')
        
        # 檢查是否已處理
        if message_id in CONFIG["processed_messages"]:
            return
        
        CONFIG["processed_messages"].add(message_id)
        
        chat_id = message.get('chat_id') or message.get('remote_jid')
        msg_type_detail = message.get('message_type', '')
        sender_name = message.get('push_name') or message.get('sender_name') or ''
        
        # 檢查是否為語音/視頻訊息
        is_voice = msg_type_detail in ['audioMessage', 'voiceMessage', 'pttMessage']
        is_video = msg_type_detail in ['videoMessage', 'videoNoteMessage']
        
        if not (is_voice or is_video):
            return
        
        media_type = "語音" if is_voice else "視頻"
        print(f"\n🎯 收到新{media_type}訊息!")
        print(f"   聊天: {chat_id}")
        print(f"   發送者: {sender_name or 'Unknown'}")
        print(f"   訊息ID: {message_id}")
        
        # 獲取媒體 URL
        media_url = message.get('media_url') or message.get('download_url')
        
        if not media_url:
            print(f"⚠️ 沒有媒體 URL，嘗試從 API 獲取...")
            return
        
        # 下載媒體
        filepath = download_media(message_id, media_url, chat_id)
        if not filepath:
            return
        
        # 轉錄
        result = transcribe_audio(filepath, chat_id, message_id, sender_name)
        
        if result:
            print(f"\n📝 轉錄結果已保存:")
            print(f"   📄 組合文件: {CONFIG['transcript_dir']}/{chat_id}_{message_id}_combined.txt")
            print(f"   📝 純文本: {CONFIG['transcript_dir']}/{chat_id}_{message_id}.txt")
            print(f"   📊 JSON: {CONFIG['transcript_dir']}/{chat_id}_{message_id}.json")
            
            # 顯示組合文件內容預覽
            combined_file = Path(CONFIG["transcript_dir"]) / f"{chat_id}_{message_id}_combined.txt"
            if combined_file.exists():
                with open(combined_file, 'r', encoding='utf-8') as f:
                    preview = f.read()
                    print(f"\n📋 組合文件內容預覽:")
                    print("-" * 40)
                    print(preview[:500] + "..." if len(preview) > 500 else preview)
                    print("-" * 40)
            
    except Exception as e:
        print(f"❌ 處理訊息時出錯: {e}")

async def connect_websocket():
    """連接 WebSocket 並監聽訊息"""
    uri = CONFIG["ws_url"]
    
    print(f"🔌 連接 WebSocket: {uri}")
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("✅ WebSocket 已連接!")
                print("👂 正在監聽新訊息...")
                print("💡 收到語音/視頻訊息時會自動轉錄\n")
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await process_message(data)
                    except json.JSONDecodeError:
                        print(f"⚠️ 收到無效 JSON: {message[:100]}")
                    except Exception as e:
                        print(f"❌ 處理訊息時出錯: {e}")
                        
        except websockets.exceptions.ConnectionClosed:
            print("⚠️ WebSocket 連接已關閉，5秒後重連...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"❌ WebSocket 錯誤: {e}")
            print("🔄 5秒後重連...")
            await asyncio.sleep(5)

def main():
    """主函數"""
    print("=" * 60)
    print("🎙️ WhatsApp 語音訊息自動轉錄器")
    print("=" * 60)
    print()
    
    # 確保目錄存在
    ensure_dirs()
    
    # 載入模型
    load_model()
    
    print(f"📁 下載目錄: {CONFIG['download_dir']}")
    print(f"📁 轉錄目錄: {CONFIG['transcript_dir']}")
    print(f"🤖 模型: {CONFIG['model_size']}")
    print(f"📝 輸出格式: 組合文件（音頻信息 + 轉錄文字）")
    print()
    
    # 啟動 WebSocket 監聽
    try:
        asyncio.run(connect_websocket())
    except KeyboardInterrupt:
        print("\n\n👋 已停止")

if __name__ == "__main__":
    main()
