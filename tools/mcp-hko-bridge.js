#!/usr/bin/env node
/**
 * mcp-hko-bridge - Hong Kong Observatory Weather MCP Bridge
 * 香港天文台天氣查詢 MCP Bridge
 */

const https = require('https');

const HKO_API_BASE = 'data.weather.gov.hk';

// Available data types for HKO API
const DATA_TYPES = {
  'flw': 'Local Weather Forecast (本地天氣預報)',
  'fnd': '9-day Weather Forecast (9天天氣預報)',
  'rhrread': 'Current Weather Report (實時天氣報告)',
  'warnsum': 'Weather Warning Summary (天氣警告摘要)',
  'swt': 'Special Weather Tips (特別天氣提示)'
};

function fetchHKOData(dataType, lang = 'en') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HKO_API_BASE,
      port: 443,
      path: `/weatherAPI/opendata/weather.php?dataType=${dataType}&lang=${lang}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenClaw-HKO-Bridge/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function formatWeatherReport(data, dataType) {
  const lang = data.updateTime ? 'en' : 'tc';
  
  switch (dataType) {
    case 'flw':
      return formatLocalForecast(data);
    case 'fnd':
      return format9DayForecast(data);
    case 'rhrread':
      return formatCurrentWeather(data);
    case 'warnsum':
      return formatWarningSummary(data);
    case 'swt':
      return formatSpecialTips(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatLocalForecast(data) {
  return `
╔══════════════════════════════════════════════════════════╗
║           香港天氣預報 / Hong Kong Weather Forecast        ║
╠══════════════════════════════════════════════════════════╣
🌤️ 概況 / General Situation:
   ${data.generalSituation || 'N/A'}

📝 預報 / Forecast:
   ${data.forecastPeriod || ''}
   ${data.forecastDesc || ''}

📅 展望 / Outlook:
   ${data.outlook || ''}

🕐 更新時間 / Update Time:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
}

function format9DayForecast(data) {
  let output = `
╔══════════════════════════════════════════════════════════╗
║        9天天氣預報 / 9-Day Weather Forecast               ║
╠══════════════════════════════════════════════════════════╣
🌤️ 概況 / General Situation:
   ${data.generalSituation || 'N/A'}

📅 預報 / Forecast:
`;

  if (data.weatherForecast && Array.isArray(data.weatherForecast)) {
    data.weatherForecast.forEach((day, index) => {
      output += `
   Day ${index + 1}: ${day.forecastDate || 'N/A'}
   🌡️ 溫度 / Temp: ${day.forecastMintemp?.value || '?'}°${day.forecastMintemp?.unit || 'C'} - ${day.forecastMaxtemp?.value || '?'}°${day.forecastMaxtemp?.unit || 'C'}
   💧 濕度 / Humidity: ${day.forecastMinrh?.value || '?'}% - ${day.forecastMaxrh?.value || '?'}%
   🌤️ 天氣 / Weather: ${day.forecastWeather || 'N/A'}
   💨 風 / Wind: ${day.forecastWind || 'N/A'}
`;
    });
  }

  output += `
🕐 更新時間 / Update Time:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  return output;
}

function formatCurrentWeather(data) {
  const temp = data.temperature?.data?.[0];
  const humidity = data.humidity?.data?.[0];
  
  return `
╔══════════════════════════════════════════════════════════╗
║        實時天氣 / Current Weather                          ║
╠══════════════════════════════════════════════════════════╣
🌡️ 溫度 / Temperature:
   ${temp ? `${temp.value}°${temp.unit} at ${temp.place}` : 'N/A'}

💧 相對濕度 / Relative Humidity:
   ${humidity ? `${humidity.value}${humidity.unit} at ${humidity.place}` : 'N/A'}

🕐 更新時間 / Update Time:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
}

function formatWarningSummary(data) {
  if (!data || Object.keys(data).length === 0) {
    return `
╔══════════════════════════════════════════════════════════╗
║        天氣警告摘要 / Weather Warning Summary              ║
╠══════════════════════════════════════════════════════════╣
✅ 現時沒有任何天氣警告生效
   No weather warnings in effect
╚══════════════════════════════════════════════════════════╝
`;
  }
  
  let output = `
╔══════════════════════════════════════════════════════════╗
║        天氣警告摘要 / Weather Warning Summary              ║
╠══════════════════════════════════════════════════════════╣
`;
  
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'updateTime') {
      output += `⚠️ ${key}: ${value}\n`;
    }
  }
  
  output += `
🕐 更新時間 / Update Time:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
  return output;
}

function formatSpecialTips(data) {
  if (!data || !data.swt) {
    return `
╔══════════════════════════════════════════════════════════╗
║        特別天氣提示 / Special Weather Tips                 ║
╠══════════════════════════════════════════════════════════╣
✅ 現時沒有特別天氣提示
   No special weather tips
╚══════════════════════════════════════════════════════════╝
`;
  }
  
  return `
╔══════════════════════════════════════════════════════════╗
║        特別天氣提示 / Special Weather Tips                 ║
╠══════════════════════════════════════════════════════════╣
📢 ${data.swt}

🕐 更新時間 / Update Time:
   ${data.updateTime || 'N/A'}
╚══════════════════════════════════════════════════════════╝
`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const lang = args.includes('--tc') ? 'tc' : args.includes('--sc') ? 'sc' : 'en';
  
  if (!command || command === '--help' || command === '-h') {
    console.log(`
Hong Kong Observatory Weather MCP Bridge
香港天文台天氣 MCP Bridge

Usage: mcp-hko <command> [options]

Commands:
  flw       Local Weather Forecast (本地天氣預報)
  fnd       9-day Weather Forecast (9天天氣預報)
  current   Current Weather Report (實時天氣報告)
  warn      Weather Warning Summary (天氣警告摘要)
  tips      Special Weather Tips (特別天氣提示)
  all       Fetch all weather data (獲取所有天氣數據)

Options:
  --tc      Traditional Chinese (繁體中文)
  --sc      Simplified Chinese (簡體中文)
  --en      English (default)

Examples:
  mcp-hko flw --tc          # 本地天氣預報 (繁體)
  mcp-hko fnd               # 9-day forecast (English)
  mcp-hko current --sc      # 實時天氣 (簡體)
  mcp-hko all --tc          # 所有天氣數據 (繁體)
`);
    process.exit(0);
  }

  try {
    let data;
    
    switch (command) {
      case 'flw':
        data = await fetchHKOData('flw', lang);
        console.log(formatWeatherReport(data, 'flw'));
        break;
        
      case 'fnd':
        data = await fetchHKOData('fnd', lang);
        console.log(formatWeatherReport(data, 'fnd'));
        break;
        
      case 'current':
        data = await fetchHKOData('rhrread', lang);
        console.log(formatWeatherReport(data, 'rhrread'));
        break;
        
      case 'warn':
        data = await fetchHKOData('warnsum', lang);
        console.log(formatWeatherReport(data, 'warnsum'));
        break;
        
      case 'tips':
        data = await fetchHKOData('swt', lang);
        console.log(formatWeatherReport(data, 'swt'));
        break;
        
      case 'all':
        console.log('\n📊 獲取所有天氣數據...\n');
        
        const flw = await fetchHKOData('flw', lang);
        console.log(formatWeatherReport(flw, 'flw'));
        
        const current = await fetchHKOData('rhrread', lang);
        console.log(formatWeatherReport(current, 'rhrread'));
        
        const warn = await fetchHKOData('warnsum', lang);
        console.log(formatWeatherReport(warn, 'warnsum'));
        
        const tips = await fetchHKOData('swt', lang);
        console.log(formatWeatherReport(tips, 'swt'));
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "mcp-hko --help" for usage information.');
        process.exit(1);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
