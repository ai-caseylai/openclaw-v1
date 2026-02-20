#!/usr/bin/env node
/**
 * mcp-http-bridge - HTTP MCP Server 到 CLI 的橋接工具
 * 讓 OpenClaw 可以透過 CLI 介面呼叫 HTTP/Streamable HTTP MCP Server
 * 
 * 使用方法:
 *   mcp-http-bridge <server-name> <tool-name> '<json-args>'
 * 
 * 支援的 HTTP MCP Server:
 *   zai_search    - 智譜 AI 搜尋 (web-search-prime)
 *   zai_reader    - 智譜 AI 網頁閱讀 (web-reader)
 *   zai_zread     - 智譜 AI GitHub 閱讀 (zread)
 */

const http = require('http');
const https = require('https');

// HTTP MCP Server 配置
const HTTP_SERVER_CONFIGS = {
  zai_search: {
    url: 'https://api.z.ai/api/mcp/web_search_prime/mcp',
    apiKey: process.env.Z_AI_API_KEY,
    type: 'streamable-http'
  },
  zai_reader: {
    url: 'https://api.z.ai/api/mcp/web_reader/mcp',
    apiKey: process.env.Z_AI_API_KEY,
    type: 'streamable-http'
  },
  zai_zread: {
    url: 'https://api.z.ai/api/mcp/zread/mcp',
    apiKey: process.env.Z_AI_API_KEY,
    type: 'streamable-http'
  }
};

// 工具參數映射
const TOOL_PARAMS = {
  zai_search: {
    webSearchPrime: ['query', 'num', 'page']
  },
  zai_reader: {
    webReader: ['url', 'include_links', 'include_metadata']
  },
  zai_zread: {
    search_doc: ['repo', 'query', 'type'],
    get_repo_structure: ['repo', 'branch'],
    read_file: ['repo', 'path', 'branch']
  }
};

function showHelp() {
  console.log(`
mcp-http-bridge - HTTP MCP Server CLI 橋接工具

使用方法:
  mcp-http-bridge <server-name> <tool-name> '<json-args>'
  mcp-http-bridge --list                    列出可用的 HTTP MCP Server
  mcp-http-bridge --help                    顯示此說明

HTTP MCP Server:
  zai_search    - 智譜 AI 搜尋 (web-search-prime)
  zai_reader    - 智譜 AI 網頁閱讀 (web-reader)
  zai_zread     - 智譜 AI GitHub 閱讀 (zread)

範例:
  mcp-http-bridge zai_search webSearchPrime '{"query": "OpenClaw AI"}'
  mcp-http-bridge zai_reader webReader '{"url": "https://openclaw.ai"}'
  mcp-http-bridge zai_zread search_doc '{"repo": "openclaw/openclaw", "query": "bug"}'

環境變數:
  Z_AI_API_KEY    - 智譜 AI API 金鑰
`);
}

function listServers() {
  console.log('可用的 HTTP MCP Server:');
  console.log('');
  Object.entries(HTTP_SERVER_CONFIGS).forEach(([name, config]) => {
    const tools = TOOL_PARAMS[name] ? Object.keys(TOOL_PARAMS[name]).join(', ') : 'N/A';
    console.log(`  ${name.padEnd(12)} - ${tools}`);
  });
}

async function makeRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (url.startsWith('https:') ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...headers
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve({ text: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function callHttpMcpServer(serverName, toolName, toolArgs) {
  const config = HTTP_SERVER_CONFIGS[serverName];
  if (!config) {
    console.error(`錯誤: 未知的 HTTP MCP Server "${serverName}"`);
    console.error(`可用的 server: ${Object.keys(HTTP_SERVER_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  if (!config.apiKey) {
    console.error('錯誤: 使用智譜 AI HTTP MCP Server 需要設定 Z_AI_API_KEY 環境變數');
    process.exit(1);
  }

  // 構建 MCP 請求
  const mcpRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: toolArgs
    },
    id: Date.now()
  };

  try {
    const result = await makeRequest(
      config.url,
      'POST',
      {
        'Authorization': `Bearer ${config.apiKey}`
      },
      mcpRequest
    );

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`錯誤: ${error.message}`);
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

  // 列出可用 server
  if (args[0] === '--list' || args[0] === '-l') {
    listServers();
    process.exit(0);
  }

  // 檢查參數數量
  if (args.length < 2) {
    console.error('錯誤: 參數不足');
    console.error('使用: mcp-http-bridge <server-name> <tool-name> [\'<json-args>\']');
    process.exit(1);
  }

  const serverName = args[0];
  const toolName = args[1];
  let toolArgs = {};

  // 解析 JSON 參數
  if (args[2]) {
    try {
      toolArgs = JSON.parse(args[2]);
    } catch (e) {
      console.error(`錯誤: 無法解析 JSON 參數: ${e.message}`);
      console.error(`輸入: ${args[2]}`);
      process.exit(1);
    }
  }

  await callHttpMcpServer(serverName, toolName, toolArgs);
}

main().catch(err => {
  console.error(`未預期的錯誤: ${err.message}`);
  process.exit(1);
});
