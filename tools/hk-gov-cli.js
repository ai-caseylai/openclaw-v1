#!/usr/bin/env node
/**
 * hk-gov - Hong Kong Government Open Data CLI Tool
 * 香港政府開放數據 CLI 工具
 * 
 * Usage: hk-gov <command> [options]
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = '/root/.openclaw/tools/hk-gov-mcp-server.js';

// Available commands mapping
const COMMANDS = {
  // Weather (HKO)
  'weather': { tool: 'hko_local_forecast', desc: '本地天氣預報' },
  'forecast': { tool: 'hko_9day_forecast', desc: '9天天氣預報' },
  'current': { tool: 'hko_current_weather', desc: '實時天氣' },
  'warnings': { tool: 'hko_weather_warnings', desc: '天氣警告' },
  'tips': { tool: 'hko_special_tips', desc: '特別天氣提示' },
  'earthquake': { tool: 'hko_earthquake_info', desc: '地震資訊' },
  
  // Transport
  'traffic': { tool: 'td_traffic_speed', desc: '交通速度' },
  
  // Hospital
  'ae': { tool: 'ha_ae_waiting_time', desc: '急症室輪候時間' },
  'hospital': { tool: 'ha_ae_waiting_time', desc: '急症室輪候時間' },
  
  // Bus
  'kmb-routes': { tool: 'kmb_get_routes', desc: '九巴路線' },
  'kmb-stops': { tool: 'kmb_get_stops', desc: '九巴巴士站' },
};

function callMCPTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    server.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    server.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}: ${errorOutput}`));
        return;
      }
      
      // Parse the last JSON response
      const lines = output.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const response = JSON.parse(lines[i]);
          if (response.result?.content?.[0]?.text) {
            resolve(response.result.content[0].text);
            return;
          }
        } catch (e) {
          // Continue to next line
        }
      }
      
      resolve(output);
    });
    
    // Send initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "hk-gov-cli", version: "1.0.0" }
      }
    };
    
    // Send tools/list request
    const listRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    };
    
    // Send tool call request
    const callRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    // Send requests sequentially
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    setTimeout(() => {
      server.stdin.write(JSON.stringify(listRequest) + '\n');
      
      setTimeout(() => {
        server.stdin.write(JSON.stringify(callRequest) + '\n');
        server.stdin.end();
      }, 100);
    }, 100);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      server.kill();
      reject(new Error('Request timeout'));
    }, 30000);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse options
  const lang = args.includes('--tc') ? 'tc' : args.includes('--sc') ? 'sc' : 'tc';
  const help = args.includes('--help') || args.includes('-h') || !command;
  
  if (help) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     香港政府開放數據 CLI / HK Government Open Data CLI    ║
╠══════════════════════════════════════════════════════════╣

Usage: hk-gov <command> [options]

Commands:

🌤️  天氣 Weather (HKO):
  weather          本地天氣預報 / Local weather forecast
  forecast         9天天氣預報 / 9-day forecast
  current          實時天氣 / Current weather
  warnings         天氣警告 / Weather warnings
  tips             特別天氣提示 / Special weather tips
  earthquake       地震資訊 / Earthquake info

🚗 交通 Transport:
  traffic          交通速度圖 / Traffic speed map

🏥 醫療 Healthcare:
  ae, hospital     急症室輪候時間 / A&E waiting time

🚌 巴士 Bus:
  kmb-routes       九巴路線列表 / KMB routes
  kmb-stops        九巴巴士站列表 / KMB stops

Options:
  --tc             繁體中文 (預設)
  --sc             簡體中文
  --help, -h       顯示此說明

Examples:
  hk-gov weather --tc
  hk-gov forecast
  hk-gov current --sc
  hk-gov ae
  hk-gov traffic

╚══════════════════════════════════════════════════════════╝
`);
    process.exit(0);
  }
  
  const cmdConfig = COMMANDS[command];
  
  if (!cmdConfig) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "hk-gov --help" for usage information.');
    process.exit(1);
  }
  
  try {
    console.log(`正在查詢 ${cmdConfig.desc}...\n`);
    
    const result = await callMCPTool(cmdConfig.tool, { language: lang });
    console.log(result);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
