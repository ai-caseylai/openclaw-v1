#!/usr/bin/env node
/**
 * mcp-call - 簡易 MCP Server 到 CLI 的橋接工具
 * 讓 OpenClaw 可以透過 CLI 介面呼叫任何 MCP Server
 * 
 * 使用方法:
 *   mcp-call <server-name> <tool-name> '<json-args>'
 * 
 * 範例:
 *   mcp-call filesystem read_file '{"path": "/tmp/test.txt"}'
 *   mcp-call github search_issues '{"query": "bug in login"}'
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// MCP Server 配置映射
const SERVER_CONFIGS = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
  },
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github']
  },
  postgres: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL || 'postgresql://localhost/mydb']
  },
  puppeteer: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer']
  },
  brave: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: ['BRAVE_API_KEY']
  },
  serper: {
    command: '/root/.openclaw/tools/venv/bin/python3',
    args: ['-c', 'from serper_mcp_server import main; main()'],
    env: ['SERPER_API_KEY']
  },
  zai_vision: {
    command: 'npx',
    args: ['-y', '@z_ai/mcp-server'],
    env: ['Z_AI_API_KEY', 'Z_AI_MODE']
  },
  nanobanana: {
    command: '/root/.openclaw/tools/venv/bin/python3',
    args: ['-m', 'nanobanana_mcp_server.server'],
    env: ['GEMINI_API_KEY']
  },
  // 支援自定義命令
  custom: {
    command: process.env.MCP_CUSTOM_CMD,
    args: process.env.MCP_CUSTOM_ARGS?.split(' ') || []
  }
};

function showHelp() {
  console.log(`
mcp-call - MCP Server CLI 橋接工具

使用方法:
  mcp-call <server-name> <tool-name> '<json-args>'
  mcp-call --list                    列出可用的 MCP Server
  mcp-call --help                    顯示此說明

內建 MCP Server:
  filesystem    - 檔案系統操作 (讀寫檔案、列出目錄)
  github        - GitHub API 操作 (需要 GITHUB_PERSONAL_ACCESS_TOKEN)
  postgres      - PostgreSQL 資料庫 (需要 DATABASE_URL)
  puppeteer     - 瀏覽器自動化 (已棄用，可能無法使用)
  brave         - Brave 搜尋 (需要 BRAVE_API_KEY)
  serper        - Serper Google 搜尋 (需要 SERPER_API_KEY)
  zai_vision    - 智譜 AI Vision (圖像/視頻分析，需要 Z_AI_API_KEY)
  nanobanana    - Nano Banana Pro (AI 圖像生成，需要 GEMINI_API_KEY)
  custom        - 自定義 (透過 MCP_CUSTOM_CMD 和 MCP_CUSTOM_ARGS)

注意: sqlite 和 fetch server 已從 npm 移除，請使用其他工具替代

範例:
  mcp-call filesystem read_file '{"path": "/root/.openclaw/workspace/test.txt"}'
  mcp-call filesystem list_directory '{"path": "/root/.openclaw/workspace"}'
  mcp-call github search_issues '{"query": "repo:facebook/react bug"}'

環境變數:
  DATABASE_URL              - postgres server 的連線字串
  GITHUB_PERSONAL_ACCESS_TOKEN - github server 的認證
  BRAVE_API_KEY             - brave server 的 API 金鑰
  SERPER_API_KEY            - serper server 的 API 金鑰
  Z_AI_API_KEY              - 智譜 AI server 的 API 金鑰
  Z_AI_MODE                 - 智譜 AI 平台模式 (設為 ZAI)
  GEMINI_API_KEY            - Nano Banana Pro (Google Gemini) 的 API 金鑰
  MCP_CUSTOM_CMD            - custom server 的命令
  MCP_CUSTOM_ARGS           - custom server 的參數
`);
}

function listServers() {
  console.log('可用的 MCP Server:');
  console.log('');
  Object.entries(SERVER_CONFIGS).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(12)} - ${config.args[1] || 'custom'}`);
  });
}

async function callMcpServer(serverName, toolName, toolArgs) {
  const config = SERVER_CONFIGS[serverName];
  if (!config) {
    console.error(`錯誤: 未知的 MCP Server "${serverName}"`);
    console.error(`可用的 server: ${Object.keys(SERVER_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  if (serverName === 'custom' && !config.command) {
    console.error('錯誤: 使用 custom server 需要設定 MCP_CUSTOM_CMD 環境變數');
    process.exit(1);
  }

  const client = new Client({ 
    name: 'mcp-call', 
    version: '1.0.0' 
  });

  // 準備環境變數
  const env = { ...process.env };
  if (config.env) {
    config.env.forEach(key => {
      if (process.env[key]) {
        env[key] = process.env[key];
      }
    });
  }

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env
  });

  try {
    await client.connect(transport);

    // 列出可用工具 (用於除錯)
    // const tools = await client.listTools();
    // console.error('可用工具:', tools.tools.map(t => t.name));

    const result = await client.callTool({
      name: toolName,
      arguments: toolArgs
    });

    // 輸出結果為 JSON
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(`錯誤: ${error.message}`);
    process.exit(1);
  } finally {
    await client.close();
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
    console.error('使用: mcp-call <server-name> <tool-name> [\'<json-args>\']');
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

  await callMcpServer(serverName, toolName, toolArgs);
}

main().catch(err => {
  console.error(`未預期的錯誤: ${err.message}`);
  process.exit(1);
});
