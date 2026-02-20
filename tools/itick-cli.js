#!/usr/bin/env node
/**
 * itick - iTick Stock Data CLI Tool
 * iTick 股票數據 CLI 工具
 */

const https = require('https');

const ITICK_API_KEY = "ccb24de20f0a4da4984e9e75d86192ef8a64ef08947b43c780fdef1193a7fd23";

function fetchITick(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.itick.org",
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'token': ITICK_API_KEY,
        'User-Agent': 'OpenClaw-iTick-CLI/1.0'
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
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

// Commands
const COMMANDS = {
  async search(code, region = 'hk') {
    const data = await fetchITick(`/symbol/list?type=stock&region=${region}&code=${code}`);
    
    if (data.code !== 0 || !data.data || data.data.length === 0) {
      console.log(`❌ 找不到股票: ${code}`);
      return;
    }
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║              股票搜索結果 / Symbol Search                  ║
╚══════════════════════════════════════════════════════════╝
`);
    
    data.data.forEach((item, index) => {
      console.log(`${index + 1}. ${item.n} (${item.c})`);
      console.log(`   🏢 交易所: ${item.e}`);
      console.log(`   📊 類型: ${item.t}`);
      console.log(`   🏭 行業: ${item.s}`);
      console.log(`   📝 英文名: ${item.l}`);
      console.log();
    });
  },
  
  async price(code, region = 'hk') {
    const data = await fetchITick(`/quote?region=${region}&code=${code}`);
    
    if (data.code !== 0) {
      console.log(`❌ 獲取價格失敗: ${data.msg}`);
      return;
    }
    
    const d = data.data;
    console.log(`
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
`);
  },
  
  async kline(code, region = 'hk', period = '1d') {
    const data = await fetchITick(`/kline?region=${region}&code=${code}&period=${period}&limit=30`);
    
    if (data.code !== 0) {
      console.log(`❌ 獲取K線失敗: ${data.msg}`);
      return;
    }
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║              K線數據 / K-line Data (${period})              ║
╠══════════════════════════════════════════════════════════╣
`);
    
    data.data.slice(0, 10).forEach((k) => {
      const date = new Date(k.t).toLocaleDateString('zh-HK');
      console.log(`📅 ${date}`);
      console.log(`   開: ${k.o}  高: ${k.h}  低: ${k.l}  收: ${k.c}`);
      console.log(`   量: ${k.v}`);
      console.log();
    });
    
    console.log(`共 ${data.data.length} 條記錄`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);
  }
};

// Main
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (!cmd || cmd === '--help') {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     iTick 股票數據 CLI / iTick Stock Data CLI             ║
╠══════════════════════════════════════════════════════════╣

Usage: itick <command> [options]

Commands:
  search <code> [region]    搜索股票 (預設: hk)
  price <code> [region]     查詢實時價格
  kline <code> [period]     查詢K線數據 (1m, 5m, 15m, 30m, 1h, 1d, 1w, 1M)

Regions: hk (香港), us (美國), cn (中國), sg (新加坡), jp (日本)

Examples:
  itick search 700          # 搜索騰訊 (香港)
  itick search AAPL us      # 搜索蘋果 (美國)
  itick price 700           # 查詢騰訊價格
  itick price TSLA us       # 查詢特斯拉價格
  itick kline 700 1d        # 查詢騰訊日K線

╚══════════════════════════════════════════════════════════╝
`);
    return;
  }
  
  const handler = COMMANDS[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
  
  try {
    await handler(args[1], args[2]);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
