#!/usr/bin/env node
/**
 * hk-gov-mcp-server - Hong Kong Government Open Data MCP Server
 * 香港政府開放數據 MCP Server (STDIO-based for OpenClaw)
 * 
 * This server implements the Model Context Protocol (MCP) over STDIO
 * to provide access to Hong Kong Government open data APIs.
 */

const https = require('https');
const http = require('http');

// MCP Protocol Constants
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "hk-gov-mcp-server";
const SERVER_VERSION = "1.0.0";

// HK Government API Endpoints
const HK_APIS = {
  // Hong Kong Observatory
  hko: {
    baseUrl: 'data.weather.gov.hk',
    endpoints: {
      localForecast: '/weatherAPI/opendata/weather.php?dataType=flw&lang={lang}',
      nineDayForecast: '/weatherAPI/opendata/weather.php?dataType=fnd&lang={lang}',
      currentWeather: '/weatherAPI/opendata/weather.php?dataType=rhrread&lang={lang}',
      weatherWarnings: '/weatherAPI/opendata/weather.php?dataType=warnsum&lang={lang}',
      specialTips: '/weatherAPI/opendata/weather.php?dataType=swt&lang={lang}',
      earthquake: '/weatherAPI/opendata/earthquake.php?dataType=eqinfo&lang={lang}',
      tsunami: '/weatherAPI/opendata/tsunami.php?dataType=tsinfo&lang={lang}'
    }
  },
  // Transport Department - Traffic Speed Map
  tdTraffic: {
    baseUrl: 'api.data.gov.hk',
    endpoints: {
      trafficSpeed: '/v1/transport/traffic-speed-map',
      trafficSnapshot: '/v1/transport/traffic-speed-map/snapshot'
    }
  },
  // Transport Department - Bus ETA
  busEta: {
    baseUrl: 'data.etabus.gov.hk',
    endpoints: {
      kmbRoutes: '/v1/transport/kmb/route/',
      kmbStops: '/v1/transport/kmb/stop/',
      kmbEta: '/v1/transport/kmb/eta/{stop_id}/{route}/{dir}/'
    }
  },
  // Hospital Authority - A&E Waiting Time
  ha: {
    baseUrl: 'www.ha.org.hk',
    endpoints: {
      aewaiting: '/opendata/aed/aedwtdata-en.json'
    }
  },
  // Food and Environmental Hygiene Department
  fehd: {
    baseUrl: 'api.data.gov.hk',
    endpoints: {
      marketStalls: '/v1/food/market-stalls'
    }
  },
  // Census and Statistics Department
  csd: {
    baseUrl: 'api.data.gov.hk',
    endpoints: {
      population: '/v1/census-statistics/population'
    }
  }
};

// Utility: Make HTTPS request
function httpsRequest(hostname, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenClaw-HK-Gov-MCP/1.0',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
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

// Utility: Make HTTP request
function httpRequest(hostname, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 80,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenClaw-HK-Gov-MCP/1.0',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
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
class HKGovMCPServer {
  constructor() {
    this.tools = this.defineTools();
  }

  defineTools() {
    return [
      // HKO Tools
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
      // Transport Department Tools
      {
        name: "td_traffic_speed",
        description: "Get Hong Kong traffic speed map data (香港交通速度圖)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      // Hospital Authority Tools
      {
        name: "ha_ae_waiting_time",
        description: "Get A&E waiting time for Hong Kong hospitals (公立醫院急症室輪候時間)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      // KMB Bus Tools
      {
        name: "kmb_get_routes",
        description: "Get all KMB bus routes (九巴路線列表)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "kmb_get_stops",
        description: "Get all KMB bus stops (九巴巴士站列表)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "kmb_get_eta",
        description: "Get KMB bus ETA for a specific stop and route (查詢九巴到站時間)",
        inputSchema: {
          type: "object",
          properties: {
            stop_id: {
              type: "string",
              description: "Stop ID (巴士站編號)"
            },
            route: {
              type: "string",
              description: "Route number (路線號碼)"
            },
            direction: {
              type: "string",
              enum: ["inbound", "outbound"],
              description: "Direction: inbound or outbound"
            }
          },
          required: ["stop_id", "route", "direction"]
        }
      }
    ];
  }

  // Tool Handlers
  async handleToolCall(toolName, args) {
    const lang = args?.language || 'tc';
    
    switch (toolName) {
      // HKO Tools
      case 'hko_local_forecast':
        return await this.getHKOLocalForecast(lang);
      case 'hko_9day_forecast':
        return await this.getHKO9DayForecast(lang);
      case 'hko_current_weather':
        return await this.getHKOCurrentWeather(lang);
      case 'hko_weather_warnings':
        return await this.getHKOWarnings(lang);
      case 'hko_special_tips':
        return await this.getHKOSpecialTips(lang);
      case 'hko_earthquake_info':
        return await this.getHKOEarthquake(lang);
      
      // Transport Tools
      case 'td_traffic_speed':
        return await this.getTrafficSpeed();
      
      // Hospital Authority Tools
      case 'ha_ae_waiting_time':
        return await this.getAEWaitingTime();
      
      // KMB Tools
      case 'kmb_get_routes':
        return await this.getKMBRoutes();
      case 'kmb_get_stops':
        return await this.getKMBStops();
      case 'kmb_get_eta':
        return await this.getKMBETA(args.stop_id, args.route, args.direction);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // HKO API Methods
  async getHKOLocalForecast(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/weather.php?dataType=flw&lang=${lang}`
    );
    return {
      type: "text",
      text: this.formatLocalForecast(data, lang)
    };
  }

  async getHKO9DayForecast(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/weather.php?dataType=fnd&lang=${lang}`
    );
    return {
      type: "text", 
      text: this.format9DayForecast(data, lang)
    };
  }

  async getHKOCurrentWeather(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/weather.php?dataType=rhrread&lang=${lang}`
    );
    return {
      type: "text",
      text: this.formatCurrentWeather(data, lang)
    };
  }

  async getHKOWarnings(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/weather.php?dataType=warnsum&lang=${lang}`
    );
    return {
      type: "text",
      text: this.formatWarnings(data, lang)
    };
  }

  async getHKOSpecialTips(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/weather.php?dataType=swt&lang=${lang}`
    );
    return {
      type: "text",
      text: this.formatSpecialTips(data, lang)
    };
  }

  async getHKOEarthquake(lang) {
    const data = await httpsRequest(
      HK_APIS.hko.baseUrl,
      `/weatherAPI/opendata/earthquake.php?dataType=eqinfo&lang=${lang}`
    );
    return {
      type: "text",
      text: JSON.stringify(data, null, 2)
    };
  }

  // Transport Department Methods
  async getTrafficSpeed() {
    const data = await httpsRequest(
      HK_APIS.tdTraffic.baseUrl,
      HK_APIS.tdTraffic.endpoints.trafficSpeed
    );
    return {
      type: "text",
      text: `Traffic Speed Data:\n${JSON.stringify(data, null, 2).substring(0, 2000)}...`
    };
  }

  // Hospital Authority Methods
  async getAEWaitingTime() {
    const data = await httpRequest(
      HK_APIS.ha.baseUrl,
      HK_APIS.ha.endpoints.aewaiting
    );
    return {
      type: "text",
      text: this.formatAEWaitingTime(data)
    };
  }

  // KMB Methods
  async getKMBRoutes() {
    const data = await httpsRequest(
      HK_APIS.busEta.baseUrl,
      HK_APIS.busEta.endpoints.kmbRoutes
    );
    return {
      type: "text",
      text: `KMB Routes:\n${JSON.stringify(data, null, 2).substring(0, 3000)}...`
    };
  }

  async getKMBStops() {
    const data = await httpsRequest(
      HK_APIS.busEta.baseUrl,
      HK_APIS.busEta.endpoints.kmbStops
    );
    return {
      type: "text",
      text: `Total stops: ${data?.data?.length || 'N/A'}\nFirst 10 stops:\n${JSON.stringify(data?.data?.slice(0, 10), null, 2)}`
    };
  }

  async getKMBETA(stop_id, route, direction) {
    const path = `/v1/transport/kmb/eta/${stop_id}/${route}/${direction}/`;
    const data = await httpsRequest(
      HK_APIS.busEta.baseUrl,
      path
    );
    return {
      type: "text",
      text: this.formatKMBETA(data, route, stop_id)
    };
  }

  // Format Methods
  formatLocalForecast(data, lang) {
    const isTC = lang === 'tc';
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '香港天氣預報' : 'Hong Kong Weather Forecast'}                    ║
╠══════════════════════════════════════════════════════════╣
🌤️ ${isTC ? '概況' : 'General Situation'}:
   ${data.generalSituation || 'N/A'}

📝 ${isTC ? '預報' : 'Forecast'}:
   ${data.forecastPeriod || ''}
   ${data.forecastDesc || ''}

📅 ${isTC ? '展望' : 'Outlook'}:
   ${data.outlook || ''}

🕐 ${isTC ? '更新時間' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  format9DayForecast(data, lang) {
    const isTC = lang === 'tc';
    let output = `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '9天天氣預報' : '9-Day Weather Forecast'}                      ║
╠══════════════════════════════════════════════════════════╣
🌤️ ${isTC ? '概況' : 'General Situation'}:
   ${data.generalSituation || 'N/A'}
`;

    if (data.weatherForecast && Array.isArray(data.weatherForecast)) {
      data.weatherForecast.slice(0, 5).forEach((day, index) => {
        output += `
📅 ${isTC ? '第' : 'Day'} ${index + 1}${isTC ? '天' : ''}: ${day.forecastDate || 'N/A'}
   🌡️ ${isTC ? '溫度' : 'Temp'}: ${day.forecastMintemp?.value || '?'}°${day.forecastMintemp?.unit || 'C'} - ${day.forecastMaxtemp?.value || '?'}°${day.forecastMaxtemp?.unit || 'C'}
   💧 ${isTC ? '濕度' : 'Humidity'}: ${day.forecastMinrh?.value || '?'}% - ${day.forecastMaxrh?.value || '?'}%
   🌤️ ${isTC ? '天氣' : 'Weather'}: ${day.forecastWeather || 'N/A'}
`;
      });
    }

    output += `
🕐 ${isTC ? '更新時間' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
    return output;
  }

  formatCurrentWeather(data, lang) {
    const isTC = lang === 'tc';
    const temp = data.temperature?.data?.[0];
    const humidity = data.humidity?.data?.[0];
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '實時天氣' : 'Current Weather'}                              ║
╠══════════════════════════════════════════════════════════╣
🌡️ ${isTC ? '溫度' : 'Temperature'}:
   ${temp ? `${temp.value}°${temp.unit} @ ${temp.place}` : 'N/A'}

💧 ${isTC ? '相對濕度' : 'Relative Humidity'}:
   ${humidity ? `${humidity.value}${humidity.unit} @ ${humidity.place}` : 'N/A'}

🕐 ${isTC ? '更新時間' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatWarnings(data, lang) {
    const isTC = lang === 'tc';
    
    if (!data || Object.keys(data).length === 0 || (data.code && data.code === 'MISSING')) {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '天氣警告摘要' : 'Weather Warning Summary'}                    ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有任何天氣警告生效' : 'No weather warnings in effect'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '天氣警告摘要' : 'Weather Warning Summary'}                    ║
╠══════════════════════════════════════════════════════════╣
`;
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'updateTime' && key !== 'code') {
        output += `⚠️ ${key}: ${value}\n`;
      }
    }
    
    output += `
🕐 ${isTC ? '更新時間' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
    return output;
  }

  formatSpecialTips(data, lang) {
    const isTC = lang === 'tc';
    
    if (!data || !data.swt || data.code === 'MISSING') {
      return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '特別天氣提示' : 'Special Weather Tips'}                       ║
╠══════════════════════════════════════════════════════════╣
✅ ${isTC ? '現時沒有特別天氣提示' : 'No special weather tips'}
╚══════════════════════════════════════════════════════════╝
`;
    }
    
    return `
╔══════════════════════════════════════════════════════════╗
║  ${isTC ? '特別天氣提示' : 'Special Weather Tips'}                       ║
╠══════════════════════════════════════════════════════════╣
📢 ${data.swt}

🕐 ${isTC ? '更新時間' : 'Update Time'}:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  }

  formatAEWaitingTime(data) {
    if (!data || !data.waitTime) {
      return 'Unable to fetch A&E waiting time data.';
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║  公立醫院急症室輪候時間 / A&E Waiting Time               ║
╠══════════════════════════════════════════════════════════╣
🕐 更新時間 / Update Time: ${data.updateTime || 'N/A'}

`;
    
    data.waitTime.forEach(hospital => {
      const waitTime = hospital.topWait?.replace('h', '小時').replace('m', '分鐘') || hospital.topWait;
      output += `🏥 ${hospital.hospName}\n   ⏱️ 最長輪候時間: ${waitTime}\n\n`;
    });
    
    output += `╚══════════════════════════════════════════════════════════╝`;
    return output;
  }

  formatKMBETA(data, route, stop_id) {
    if (!data || !data.data || data.data.length === 0) {
      return `No ETA data available for route ${route} at stop ${stop_id}.`;
    }
    
    let output = `
╔══════════════════════════════════════════════════════════╗
║  九巴到站時間 / KMB Bus ETA                              ║
╠══════════════════════════════════════════════════════════╣
🚌 路線 / Route: ${route}
🚏 站點 / Stop: ${stop_id}

`;
    
    data.data.slice(0, 3).forEach((eta, index) => {
      const etaTime = eta.eta ? new Date(eta.eta).toLocaleTimeString('zh-HK') : 'N/A';
      const dest = eta.dest_en || eta.dest_tc || 'N/A';
      output += `⏱️ ${index + 1}. ${etaTime} → ${dest}\n`;
    });
    
    output += `╚══════════════════════════════════════════════════════════╝`;
    return output;
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
const server = new HKGovMCPServer();
server.run().catch(console.error);
