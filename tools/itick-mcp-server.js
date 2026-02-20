#!/usr/bin/env node
/**
 * itick-mcp-server - iTick Stock Data MCP Server
 * iTick 股票數據 MCP Server (STDIO-based)
 */

const https = require('https');

// MCP Protocol Constants
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "itick-mcp-server";
const SERVER_VERSION = "1.0.0";

// API Configuration
const ITICK_API_KEY = "ccb24de20f0a4da4984e9e75d86192ef8a64ef08947b43c780fdef1193a7fd23";
const ITICK_BASE_URL = "api.itick.org";

// Utility: Make HTTPS request to iTick
function fetchITick(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ITICK_BASE_URL,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'token': ITICK_API_KEY,
        'User-Agent': 'OpenClaw-iTick-MCP/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// MCP Server Implementation
class iTickMCPServer {
  constructor() {
    this.tools = this.defineTools();
  }

  defineTools() {
    return [
      {
        name: "itick_search_symbol",
        description: "Search for stock symbol information (搜索股票代碼)",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["stock", "crypto", "forex", "index"],
              description: "Asset type",
              default: "stock"
            },
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region: hk (香港), us (美國), cn (中國), sg (新加坡), jp (日本)",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code or symbol (股票代碼)"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "itick_get_price",
        description: "Get real-time stock price (獲取實時股票價格)",
        inputSchema: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code (股票代碼)"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "itick_get_kline",
        description: "Get stock K-line/historical data (獲取股票K線/歷史數據)",
        inputSchema: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code (股票代碼)"
            },
            period: {
              type: "string",
              enum: ["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1M"],
              description: "Time period: 1m, 5m, 15m, 30m, 1h, 1d, 1w, 1M",
              default: "1d"
            },
            limit: {
              type: "number",
              description: "Number of data points",
              default: 30
            }
          },
          required: ["code"]
        }
      },
      {
        name: "itick_get_quote",
        description: "Get detailed stock quote (獲取詳細股票報價)",
        inputSchema: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code (股票代碼)"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "itick_get_depth",
        description: "Get order book depth (獲取盤口深度)",
        inputSchema: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code (股票代碼)"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "itick_get_trades",
        description: "Get recent trades (獲取最近成交)",
        inputSchema: {
          type: "object",
          properties: {
            region: {
              type: "string",
              enum: ["hk", "us", "cn", "sg", "jp"],
              description: "Market region",
              default: "hk"
            },
            code: {
              type: "string",
              description: "Stock code (股票代碼)"
            }
          },
          required: ["code"]
        }
      }
    ];
  }

  // Tool Handlers
  async handleToolCall(toolName, args) {
    const region = args?.region || 'hk';
    const code = args?.code;
    
    if (!code) {
      throw new Error('Stock code is required');
    }
    
    switch (toolName) {
      case 'itick_search_symbol':
        return await this.searchSymbol(args?.type || 'stock', region, code);
      case 'itick_get_price':
        return await this.getPrice(region, code);
      case 'itick_get_kline':
        return await this.getKline(region, code, args?.period || '1d', args?.limit || 30);
      case 'itick_get_quote':
        return await this.getQuote(region, code);
      case 'itick_get_depth':
        return await this.getDepth(region, code);
      case 'itick_get_trades':
        return await this.getTrades(region, code);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // API Methods
  async searchSymbol(type, region, code) {
    const data = await fetchITick(`/symbol/list?type=${type}&region=${region}&code=${code}`);
    return {
      type: "text",
      text: this.formatSymbolSearch(data)
    };
  }

  async getPrice(region, code) {
    const data = await fetchITick(`/quote?region=${region}&code=${code}`);
    return {
      type: "text",
      text: this.formatPrice(data)
    };
  }

  async getKline(region, code, period, limit) {
    const data = await fetchITick(`/kline?region=${region}&code=${code}&period=${period}&limit=${limit}`);
    return {
      type: "text",
      text: this.formatKline(data, period)
    };
  }

  async getQuote(region, code) {
    const data = await fetchITick(`/quote?region=${region}&code=${code}`);
    return {
      type: "text",
      text: this.formatQuote(data)
    };
  }

  async getDepth(region, code) {
    const data = await fetchITick(`/depth?region=${region}&code=${code}`);
    return {
      type: "text",
      text: this.formatDepth(data)
    };
  }

  async getTrades(region, code) {
    const data = await fetchITick(`/trades?region=${region}&code=${code}`);
    return {
      type: "text",
      text: this.formatTrades(data)
    };
  }

  // Format Methods
  formatSymbolSearch(data) {
    if (data.code !== 0 || !data.data || data.data.length === 0) {
      return `❌ 找不到相關股票\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║              股票搜索結果 / Symbol Search Results          ║
╚══════════════════════════════════════════════════════════╝

`;
    
    data.data.forEach((item, index) => {
      output += `${index + 1}. ${item.n} (${item.c})\n`;
      output += `   🏢 交易所: ${item.e}\n`;
      output += `   📊 類型: ${item.t}\n`;
      output += `   🏭 行業: ${item.s}\n`;
      output += `   📝 英文名: ${item.l}\n\n`;
    });
    
    return output;
  }

  formatPrice(data) {
    if (data.code !== 0) {
      return `❌ 獲取價格失敗\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    const d = data.data;
    return `
╔══════════════════════════════════════════════════════════╗
║              實時價格 / Real-time Price                    ║
╠══════════════════════════════════════════════════════════╣
📈 股票: ${d.n} (${d.c})
💰 最新價: ${d.p}
📊 漲跌: ${d.d} (${d.dp}%)
📈 最高: ${d.h}
📉 最低: ${d.l}
📊 開盤: ${d.o}
📊 昨收: ${d.pc}
📈 成交量: ${d.v}
🕐 時間: ${d.t}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatQuote(data) {
    if (data.code !== 0) {
      return `❌ 獲取報價失敗\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║              詳細報價 / Detailed Quote                     ║
╠══════════════════════════════════════════════════════════╣
${JSON.stringify(data.data, null, 2)}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatKline(data, period) {
    if (data.code !== 0) {
      return `❌ 獲取K線失敗\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    if (!data.data || data.data.length === 0) {
      return `❌ 沒有K線數據`;
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║              K線數據 / K-line Data (${period})              ║
╠══════════════════════════════════════════════════════════╣
`;
    
    data.data.slice(0, 10).forEach((k, index) => {
      output += `
📅 ${new Date(k.t).toLocaleDateString('zh-HK')}
   開: ${k.o}  高: ${k.h}  低: ${k.l}  收: ${k.c}
   量: ${k.v}
`;
    });
    
    output += `
共 ${data.data.length} 條記錄
╚══════════════════════════════════════════════════════════╝
`;
    return output;
  }

  formatDepth(data) {
    if (data.code !== 0) {
      return `❌ 獲取盤口失敗\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║              盤口深度 / Order Book Depth                   ║
╠══════════════════════════════════════════════════════════╣
${JSON.stringify(data.data, null, 2)}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatTrades(data) {
    if (data.code !== 0) {
      return `❌ 獲取成交失敗\n錯誤: ${data.msg || 'Unknown error'}`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║              最近成交 / Recent Trades                      ║
╠══════════════════════════════════════════════════════════╣
${JSON.stringify(data.data, null, 2)}
╚══════════════════════════════════════════════════════════╝
`;
  }

  // MCP Protocol Handlers
  handleInitialize(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      }
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: this.tools }
    };
  }

  async handleToolsCall(id, params) {
    try {
      const result = await this.handleToolCall(params.name, params.arguments);
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [result], isError: false }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        }
      };
    }
  }

  // Main Loop
  async run() {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdin.setEncoding('utf8');
    let buffer = '';
    
    stdin.on('data', async (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          let response;
          
          switch (message.method) {
            case 'initialize':
              response = this.handleInitialize(message.id);
              break;
            case 'tools/list':
              response = this.handleToolsList(message.id);
              break;
            case 'tools/call':
              response = await this.handleToolsCall(message.id, message.params);
              break;
            default:
              response = {
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32601, message: `Method not found: ${message.method}` }
              };
          }
          stdout.write(JSON.stringify(response) + '\n');
        } catch (e) {
          stdout.write(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: `Parse error: ${e.message}` }
          }) + '\n');
        }
      }
    });
    
    stdin.on('end', () => process.exit(0));
  }
}

// Run server
const server = new iTickMCPServer();
server.run().catch(console.error);
