#!/usr/bin/env node
/**
 * openrouter-image - OpenRouter 圖像生成 CLI 工具
 * 支援 Gemini 3 Pro Image、Gemini 2.5 Flash Image 等模型
 * 
 * 使用方法:
 *   openrouter-image generate '<prompt>' [options]
 *   openrouter-image --help
 * 
 * 範例:
 *   openrouter-image generate '一隻可愛的貓咪在草地上玩耍' --model google/gemini-3-pro-image-preview
 *   openrouter-image generate 'A futuristic city skyline' --model google/gemini-2.5-flash-image --output ./image.png
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// OpenRouter API 配置
const OPENROUTER_API_URL = 'openrouter.ai';
const DEFAULT_MODEL = 'google/gemini-3-pro-image-preview';

// 支援的圖像生成模型
const SUPPORTED_MODELS = {
  'google/gemini-3-pro-image-preview': {
    name: 'Gemini 3 Pro Image',
    description: 'Google 最新高品質圖像生成模型，支援 4K 解析度',
    maxResolution: '4K'
  },
  'google/gemini-2.5-flash-image': {
    name: 'Gemini 2.5 Flash Image',
    description: '快速圖像生成，適合原型設計',
    maxResolution: '1024px'
  },
  'stabilityai/stable-diffusion-xl': {
    name: 'Stable Diffusion XL',
    description: 'Stability AI 的高品質圖像生成模型',
    maxResolution: '1024px'
  }
};

function showHelp() {
  console.log(`
openrouter-image - OpenRouter 圖像生成工具

使用方法:
  openrouter-image generate '<prompt>' [options]
  openrouter-image list                    列出支援的模型
  openrouter-image --help                  顯示此說明

選項:
  --model, -m     選擇模型 (預設: google/gemini-3-pro-image-preview)
  --output, -o    輸出檔案路徑 (預設: ./generated_image.png)
  --size, -s      圖片尺寸 (如: 1024x1024, 1792x1024)

支援的模型:
  google/gemini-3-pro-image-preview    Gemini 3 Pro (4K 品質)
  google/gemini-2.5-flash-image        Gemini 2.5 Flash (快速)
  stabilityai/stable-diffusion-xl      Stable Diffusion XL

範例:
  # 使用 Gemini 3 Pro 生成圖像
  openrouter-image generate '一隻可愛的貓咪在草地上玩耍，陽光明媚'

  # 使用 Gemini 2.5 Flash 快速生成
  openrouter-image generate 'A futuristic city' --model google/gemini-2.5-flash-image

  # 指定輸出路徑
  openrouter-image generate 'Beautiful sunset' --output ./sunset.png

環境變數:
  OPENROUTER_API_KEY    - OpenRouter API 金鑰 (必需)
`);
}

function listModels() {
  console.log('支援的圖像生成模型:\n');
  Object.entries(SUPPORTED_MODELS).forEach(([id, info]) => {
    console.log(`  ${id}`);
    console.log(`    名稱: ${info.name}`);
    console.log(`    描述: ${info.description}`);
    console.log(`    解析度: ${info.maxResolution}`);
    console.log('');
  });
}

async function makeOpenRouterRequest(apiKey, model, prompt, size = null) {
  return new Promise((resolve, reject) => {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Generate an image: ${prompt}`
          }
        ]
      }
    ];

    const requestBody = {
      model: model,
      messages: messages
    };

    // 如果指定了尺寸，添加到請求中
    if (size) {
      requestBody.size = size;
    }

    const options = {
      hostname: OPENROUTER_API_URL,
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://openclaw.ai',
        'X-Title': 'OpenClaw Image Generator'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject(new Error(`無法解析 API 響應: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

function extractImageFromResponse(response) {
  // 檢查是否有圖像數據
  if (response.choices && response.choices[0] && response.choices[0].message) {
    const message = response.choices[0].message;
    
    // 檢查 content 中是否有圖像
    if (message.content) {
      // 如果是數組，尋找圖像類型
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'image_url' && item.image_url) {
            return item.image_url.url;
          }
        }
      }
      // 如果是字符串，可能是 base64 圖像
      if (typeof message.content === 'string' && message.content.startsWith('data:image')) {
        return message.content;
      }
    }
  }
  
  return null;
}

function saveImage(imageData, outputPath) {
  // 檢查是否是 base64 數據
  if (imageData.startsWith('data:image')) {
    // 提取 base64 部分
    const base64Data = imageData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outputPath, buffer);
  } else if (imageData.startsWith('http')) {
    // 如果是 URL，下載圖像
    return new Promise((resolve, reject) => {
      const client = imageData.startsWith('https') ? https : require('http');
      client.get(imageData, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          fs.writeFileSync(outputPath, buffer);
          resolve();
        });
      }).on('error', reject);
    });
  } else {
    // 純 base64
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);
  }
}

async function generateImage(prompt, options) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('錯誤: 需要設定 OPENROUTER_API_KEY 環境變數');
    console.error('請在 https://openrouter.ai/keys 獲取 API Key');
    process.exit(1);
  }

  const model = options.model || DEFAULT_MODEL;
  const outputPath = options.output || './generated_image.png';
  
  console.log(`正在使用 ${model} 生成圖像...`);
  console.log(`提示詞: ${prompt}`);
  
  try {
    const response = await makeOpenRouterRequest(apiKey, model, prompt, options.size);
    
    if (response.error) {
      console.error(`API 錯誤: ${response.error.message}`);
      process.exit(1);
    }
    
    const imageData = extractImageFromResponse(response);
    
    if (!imageData) {
      console.error('無法從響應中提取圖像數據');
      console.log('API 響應:', JSON.stringify(response, null, 2));
      process.exit(1);
    }
    
    // 保存圖像
    await saveImage(imageData, outputPath);
    
    console.log(`\n✅ 圖像已生成並保存至: ${path.resolve(outputPath)}`);
    
    // 顯示使用統計
    if (response.usage) {
      console.log(`\n使用統計:`);
      console.log(`  Prompt tokens: ${response.usage.prompt_tokens}`);
      console.log(`  Completion tokens: ${response.usage.completion_tokens}`);
      console.log(`  Total tokens: ${response.usage.total_tokens}`);
    }
    
  } catch (error) {
    console.error(`生成圖像時發生錯誤: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // 顯示說明
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  // 列出模型
  if (args[0] === 'list' || args[0] === '--list' || args[0] === '-l') {
    listModels();
    process.exit(0);
  }
  
  // 生成圖像
  if (args[0] === 'generate' || args[0] === 'gen' || args[0] === 'g') {
    const prompt = args[1];
    if (!prompt) {
      console.error('錯誤: 請提供圖像描述提示詞');
      console.error('使用: openrouter-image generate "<prompt>"');
      process.exit(1);
    }
    
    // 解析選項
    const options = {};
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--model' || args[i] === '-m') {
        options.model = args[++i];
      } else if (args[i] === '--output' || args[i] === '-o') {
        options.output = args[++i];
      } else if (args[i] === '--size' || args[i] === '-s') {
        options.size = args[++i];
      }
    }
    
    await generateImage(prompt, options);
    process.exit(0);
  }
  
  // 如果第一個參數不是命令，假設是提示詞（簡化使用）
  if (!args[0].startsWith('-')) {
    const options = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--model' || args[i] === '-m') {
        options.model = args[++i];
      } else if (args[i] === '--output' || args[i] === '-o') {
        options.output = args[++i];
      } else if (args[i] === '--size' || args[i] === '-s') {
        options.size = args[++i];
      }
    }
    
    await generateImage(args[0], options);
    process.exit(0);
  }
  
  console.error(`未知的命令: ${args[0]}`);
  console.error('使用 --help 查看使用說明');
  process.exit(1);
}

main().catch(err => {
  console.error(`未預期的錯誤: ${err.message}`);
  process.exit(1);
});
