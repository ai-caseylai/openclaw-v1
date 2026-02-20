#!/usr/bin/env node
/**
 * hko-mcp-server - Hong Kong Observatory MCP Server
 * 香港天文台 MCP Server (STDIO-based)
 * 
 * Implements Model Context Protocol (MCP) over STDIO
 * for OpenClaw integration
 */

const https = require('https');

// MCP Protocol Constants
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "hko-mcp-server";
const SERVER_VERSION = "1.0.0";

// HKO API Configuration
const HKO_BASE_URL = 'data.weather.gov.hk';

// Utility: Make HTTPS request to HKO
function fetchHKO(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HKO_BASE_URL,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenClaw-HKO-MCP/1.0'
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
class HKOMCPServer {
  constructor() {
    this.tools = this.defineTools();
  }

  defineTools() {
    return [
      {
        name: "hko_local_forecast",
        description: "Get Hong Kong local weather forecast (香港本地天氣預報)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_9day_forecast",
        description: "Get Hong Kong 9-day weather forecast (香港9天天氣預報)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_current_weather",
        description: "Get current weather conditions in Hong Kong (香港實時天氣)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_weather_warnings",
        description: "Get weather warnings in Hong Kong (香港天氣警告)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_special_tips",
        description: "Get special weather tips for Hong Kong (香港特別天氣提示)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_earthquake_info",
        description: "Get earthquake information (地震資訊)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_tsunami_info",
        description: "Get tsunami information (海嘯資訊)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      },
      {
        name: "hko_all_weather",
        description: "Get all weather information at once (獲取所有天氣資訊)",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["en", "tc", "sc"],
              description: "Language: en (English), tc (繁體中文), sc (簡體中文)",
              default: "tc"
            }
          }
        }
      }
    ];
  }

  // Tool Handlers
  async handleToolCall(toolName, args) {
    const lang = args?.language || 'tc';
    
    switch (toolName) {
      case 'hko_local_forecast':
        return await this.getLocalForecast(lang);
      case 'hko_9day_forecast':
        return await this.get9DayForecast(lang);
      case 'hko_current_weather':
        return await this.getCurrentWeather(lang);
      case 'hko_weather_warnings':
        return await this.getWeatherWarnings(lang);
      case 'hko_special_tips':
        return await this.getSpecialTips(lang);
      case 'hko_earthquake_info':
        return await this.getEarthquakeInfo(lang);
      case 'hko_tsunami_info':
        return await this.getTsunamiInfo(lang);
      case 'hko_all_weather':
        return await this.getAllWeather(lang);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // API Methods
  async getLocalForecast(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/weather.php?dataType=flw&lang=${lang}`);
    return {
      type: "text",
      text: this.formatLocalForecast(data, lang)
    };
  }

  async get9DayForecast(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/weather.php?dataType=fnd&lang=${lang}`);
    return {
      type: "text",
      text: this.format9DayForecast(data, lang)
    };
  }

  async getCurrentWeather(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/weather.php?dataType=rhrread&lang=${lang}`);
    return {
      type: "text",
      text: this.formatCurrentWeather(data, lang)
    };
  }

  async getWeatherWarnings(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/weather.php?dataType=warnsum&lang=${lang}`);
    return {
      type: "text",
      text: this.formatWarnings(data, lang)
    };
  }

  async getSpecialTips(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/weather.php?dataType=swt&lang=${lang}`);
    return {
      type: "text",
      text: this.formatSpecialTips(data, lang)
    };
  }

  async getEarthquakeInfo(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/earthquake.php?dataType=eqinfo&lang=${lang}`);
    return {
      type: "text",
      text: this.formatEarthquake(data, lang)
    };
  }

  async getTsunamiInfo(lang) {
    const data = await fetchHKO(`/weatherAPI/opendata/tsunami.php?dataType=tsinfo&lang=${lang}`);
    return {
      type: "text",
      text: this.formatTsunami(data, lang)
    };
  }

  async getAllWeather(lang) {
    const [forecast, current, warnings, tips] = await Promise.all([
      fetchHKO(`/weatherAPI/opendata/weather.php?dataType=flw&lang=${lang}`),
      fetchHKO(`/weatherAPI/opendata/weather.php?dataType=rhrread&lang=${lang}`),
      fetchHKO(`/weatherAPI/opendata/weather.php?dataType=warnsum&lang=${lang}`),
      fetchHKO(`/weatherAPI/opendata/weather.php?dataType=swt&lang=${lang}`)
    ]);

    return {
      type: "text",
      text: `
${this.formatLocalForecast(forecast, lang)}
${this.formatCurrentWeather(current, lang)}
${this.formatWarnings(warnings, lang)}
${this.formatSpecialTips(tips, lang)}
`
    };
  }

  // Format Methods
  formatLocalForecast(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '香港天氣預報' : isSC ? '香港天气预报' : 'Hong Kong Weather Forecast'}                    ║
╠══════════════════════════════════════════════════════════╣
🌤️ ${isTC ? '概況' : isSC ? '概况' : 'General Situation'}:
   ${data.generalSituation || 'N/A'}

📝 ${isTC ? '預報' : isSC ? '预报' : 'Forecast'}:
   ${data.forecastPeriod || ''}
   ${data.forecastDesc || ''}

📅 ${isTC ? '展望' : isSC ? '展望' : 'Outlook'}:
   ${data.outlook || ''}

🕐 ${isTC ? '更新時間' : isSC ? '更新时间' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  format9DayForecast(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '9天天氣預報' : isSC ? '9天天气预报' : '9-Day Weather Forecast'}                      ║
╠══════════════════════════════════════════════════════════╣
🌤️ ${isTC ? '概況' : isSC ? '概况' : 'General Situation'}:
   ${data.generalSituation || 'N/A'}
`;

    if (data.weatherForecast && Array.isArray(data.weatherForecast)) {
      data.weatherForecast.slice(0, 5).forEach((day, index) => {
        const dayLabel = isTC ? `第${index + 1}天` : isSC ? `第${index + 1}天` : `Day ${index + 1}`;
        output += `
📅 ${dayLabel}: ${day.forecastDate || 'N/A'}
   🌡️ ${isTC ? '溫度' : isSC ? '温度' : 'Temp'}: ${day.forecastMintemp?.value || '?'}°${day.forecastMintemp?.unit || 'C'} - ${day.forecastMaxtemp?.value || '?'}°${day.forecastMaxtemp?.unit || 'C'}
   💧 ${isTC ? '濕度' : isSC ? '湿度' : 'Humidity'}: ${day.forecastMinrh?.value || '?'}% - ${day.forecastMaxrh?.value || '?'}%
   🌤️ ${isTC ? '天氣' : isSC ? '天气' : 'Weather'}: ${day.forecastWeather || 'N/A'}
`;
      });
    }

    output += `
🕐 ${isTC ? '更新時間' : isSC ? '更新时间' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
    return output;
  }

  formatCurrentWeather(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    const temp = data.temperature?.data?.[0];
    const humidity = data.humidity?.data?.[0];
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '實時天氣' : isSC ? '实时天气' : 'Current Weather'}                              ║
╠══════════════════════════════════════════════════════════╣
🌡️ ${isTC ? '溫度' : isSC ? '温度' : 'Temperature'}:
   ${temp ? `${temp.value}°${temp.unit} @ ${temp.place}` : 'N/A'}

💧 ${isTC ? '相對濕度' : isSC ? '相对湿度' : 'Relative Humidity'}:
   ${humidity ? `${humidity.value}${humidity.unit} @ ${humidity.place}` : 'N/A'}

🕐 ${isTC ? '更新時間' : isSC ? '更新时间' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatWarnings(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    if (!data || Object.keys(data).length === 0 || (data.code && data.code === 'MISSING')) {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '天氣警告摘要' : isSC ? '天气警告摘要' : 'Weather Warning Summary'}                    ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有任何天氣警告生效' : isSC ? '现时没有任何天气警告生效' : 'No weather warnings in effect'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '天氣警告摘要' : isSC ? '天气警告摘要' : 'Weather Warning Summary'}                    ║
╠══════════════════════════════════════════════════════════╣
`;
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'updateTime' && key !== 'code') {
        output += `⚠️ ${key}: ${value}\n`;
      }
    }
    
    output += `
🕐 ${isTC ? '更新時間' : isSC ? '更新时间' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
    return output;
  }

  formatSpecialTips(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    if (!data || !data.swt || data.code === 'MISSING') {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '特別天氣提示' : isSC ? '特别天气提示' : 'Special Weather Tips'}                       ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有特別天氣提示' : isSC ? '现时没有特别天气提示' : 'No special weather tips'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '特別天氣提示' : isSC ? '特别天气提示' : 'Special Weather Tips'}                       ║
╠══════════════════════════════════════════════════════════╣
📢 ${data.swt}

🕐 ${isTC ? '更新時間' : isSC ? '更新时间' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatEarthquake(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    if (!data || data.code === 'MISSING') {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '地震資訊' : isSC ? '地震资讯' : 'Earthquake Information'}                          ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有地震資訊' : isSC ? '现时没有地震资讯' : 'No earthquake information'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '地震資訊' : isSC ? '地震资讯' : 'Earthquake Information'}                          ║
╠══════════════════════════════════════════════════════════╣
${JSON.stringify(data, null, 2)}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatTsunami(data, lang) {
    const isTC = lang === 'tc';
    const isSC = lang === 'sc';
    
    if (!data || data.code === 'MISSING') {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '海嘯資訊' : isSC ? '海啸资讯' : 'Tsunami Information'}                            ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有海嘯資訊' : isSC ? '现时没有海啸资讯' : 'No tsunami information'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '海嘯資訊' : isSC ? '海啸资讯' : 'Tsunami Information'}                            ║
╠══════════════════════════════════════════════════════════╣
${JSON.stringify(data, null, 2)}
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
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      }
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: this.tools
      }
    };
  }

  async handleToolsCall(id, params) {
    try {
      const result = await this.handleToolCall(params.name, params.arguments);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [result],
          isError: false
        }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: `Error: ${error.message}`
          }],
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
      
      // Process complete lines (JSON-RPC messages)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
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
                error: {
                  code: -32601,
                  message: `Method not found: ${message.method}`
                }
              };
          }
          
          stdout.write(JSON.stringify(response) + '\n');
        } catch (e) {
          stdout.write(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: `Parse error: ${e.message}`
            }
          }) + '\n');
        }
      }
    });
    
    stdin.on('end', () => {
      process.exit(0);
    });
  }
}

// Run server
const server = new HKOMCPServer();
server.run().catch(console.error);
