#!/usr/bin/env python3
"""
whisper-transcribe.py - 自動轉錄視頻和音頻文件
支援粵語、普通話、英文自動檢測
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# 使用 faster-whisper
from faster_whisper import WhisperModel

def transcribe_file(input_path, output_dir=None, model_size="small"):
    """
    轉錄單個音頻/視頻文件
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        print(f"❌ 文件不存在: {input_path}")
        return None
    
    # 決定輸出路徑
    if output_dir:
        output_path = Path(output_dir) / f"{input_path.stem}.json"
        srt_path = Path(output_dir) / f"{input_path.stem}.srt"
    else:
        output_path = input_path.parent / f"{input_path.stem}.json"
        srt_path = input_path.parent / f"{input_path.stem}.srt"
    
    print(f"🎙️ 正在轉錄: {input_path.name}")
    print(f"📦 使用模型: {model_size}")
    
    # 載入模型 (使用 CPU，如果可用會自動使用 GPU)
    model = WhisperModel(model_size, device="auto", compute_type="int8")
    
    # 自動檢測語言 (auto)，支援粵語(yue)、中文(zh)、英文(en)
    segments, info = model.transcribe(
        str(input_path),
        language=None,  # 自動檢測
        task="transcribe",
        vad_filter=True,  # 使用語音活動檢測過濾靜音
        condition_on_previous_text=True
    )
    
    # 收集結果
    results = {
        "file": str(input_path),
        "detected_language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "model": model_size,
        "transcribed_at": datetime.now().isoformat(),
        "segments": []
    }
    
    srt_lines = []
    segment_idx = 1
    
    for segment in segments:
        segment_data = {
            "id": segment.id,
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
            "confidence": segment.avg_logprob
        }
        results["segments"].append(segment_data)
        
        # 生成 SRT 格式
        start_time = format_time(segment.start)
        end_time = format_time(segment.end)
        srt_lines.append(f"{segment_idx}")
        srt_lines.append(f"{start_time} --> {end_time}")
        srt_lines.append(segment.text.strip())
        srt_lines.append("")
        
        segment_idx += 1
    
    # 保存 JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # 保存 SRT
    with open(srt_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(srt_lines))
    
    print(f"✅ 完成!")
    print(f"   檢測語言: {info.language} (信心度: {info.language_probability:.2%})")
    print(f"   時長: {info.duration:.1f} 秒")
    print(f"   輸出 JSON: {output_path}")
    print(f"   輸出 SRT: {srt_path}")
    
    return results

def format_time(seconds):
    """格式化時間為 SRT 格式 HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def batch_transcribe(directory, output_dir=None, model_size="small"):
    """
    批次轉錄目錄中的所有音頻/視頻文件
    """
    directory = Path(directory)
    
    # 支援的格式
    extensions = {'.mp3', '.mp4', '.wav', '.m4a', '.flac', '.ogg', '.webm', '.mov'}
    
    files = [f for f in directory.iterdir() if f.suffix.lower() in extensions]
    
    if not files:
        print(f"❌ 在 {directory} 中沒有找到音頻/視頻文件")
        return
    
    print(f"📁 找到 {len(files)} 個文件需要轉錄")
    print("=" * 50)
    
    for i, file_path in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}]")
        try:
            transcribe_file(file_path, output_dir, model_size)
        except Exception as e:
            print(f"❌ 轉錄失敗 {file_path.name}: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 批次轉錄完成!")

def main():
    parser = argparse.ArgumentParser(description='Whisper 音頻/視頻轉錄工具')
    parser.add_argument('input', help='輸入文件或目錄')
    parser.add_argument('-o', '--output', help='輸出目錄')
    parser.add_argument('-m', '--model', default='small', 
                       choices=['tiny', 'base', 'small', 'medium', 'large'],
                       help='模型大小 (預設: small)')
    parser.add_argument('-b', '--batch', action='store_true',
                       help='批次處理目錄中的所有文件')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    
    if args.batch or input_path.is_dir():
        batch_transcribe(input_path, args.output, args.model)
    else:
        transcribe_file(input_path, args.output, args.model)

if __name__ == "__main__":
    main()
