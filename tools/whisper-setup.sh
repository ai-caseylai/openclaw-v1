#!/bin/bash
# whisper-setup.sh - 首次運行時下載模型

echo "🎙️ Whisper 轉錄工具設置"
echo "========================"

# 啟用虛擬環境
source /root/.openclaw/tools/whisper-env/bin/activate

# 測試載入模型（會自動下載）
echo "📥 正在下載 small 模型（首次運行需要幾分鐘）..."
python3 -c "
from faster_whisper import WhisperModel
print('載入模型中...')
model = WhisperModel('small', device='auto', compute_type='int8')
print('✅ 模型載入成功！')
"

echo ""
echo "🎉 設置完成！"
echo ""
echo "使用方法:"
echo "  whisper-transcribe <文件>           # 轉錄單個文件"
echo "  whisper-transcribe <目錄> -b        # 批次轉錄目錄"
echo "  whisper-transcribe <文件> -o <輸出目錄>  # 指定輸出位置"
echo ""
echo "模型選項:"
echo "  -m tiny    # 最快，準確度一般"
echo "  -m base    # 平衡"
echo "  -m small   # 較慢，準確度高（預設）"
echo "  -m medium  # 慢，很準確"
echo "  -m large   # 最慢，最準確"
