#!/usr/bin/env node
/**
 * whatsapp-crm - WhatsApp CRM CLI Tool
 * WhatsApp CRM CLI 工具
 */

const https = require('https');

const CRM_BASE_URL = "whatsapp-crm.techforliving.app";

function fetchCRM(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: CRM_BASE_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'OpenClaw-WhatsApp-CRM-CLI/1.0'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

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
    
    if (postData) {
      req.write(postData);
    }
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

// Commands
const COMMANDS = {
  async sessions() {
    const data = await fetchCRM('GET', '/api/sessions');
    console.log('\n📱 WhatsApp Sessions:');
    console.log(JSON.stringify(data, null, 2));
  },
  
  async status(id) {
    const data = await fetchCRM('GET', `/api/session/${id}/status`);
    console.log(`\n📊 Session ${id} Status:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async start(id) {
    const data = await fetchCRM('POST', `/api/session/${id}/start`);
    console.log(`\n▶️ Session ${id} Started:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async restart(id) {
    const data = await fetchCRM('POST', `/api/session/${id}/restart`);
    console.log(`\n🔄 Session ${id} Restarted:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async logout(id) {
    const data = await fetchCRM('POST', `/api/session/${id}/logout`);
    console.log(`\n👋 Session ${id} Logged Out:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async qr(id) {
    const data = await fetchCRM('GET', `/api/session/${id}/qr`);
    console.log(`\n📱 QR Code for ${id}:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async contacts(id) {
    const data = await fetchCRM('GET', `/api/session/${id}/contacts`);
    console.log(`\n👥 Contacts for ${id}:`);
    if (Array.isArray(data)) {
      data.slice(0, 20).forEach((c, i) => {
        console.log(`${i + 1}. ${c.name || c.pushname || 'Unknown'} - ${c.id || c.jid}`);
      });
      if (data.length > 20) console.log(`... and ${data.length - 20} more`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  },
  
  async messages(id, jid) {
    const data = await fetchCRM('GET', `/api/session/${id}/messages/${jid}`);
    console.log(`\n💬 Messages for ${jid}:`);
    if (Array.isArray(data)) {
      data.slice(0, 10).forEach((m, i) => {
        const content = m.content || m.body || m.message || 'N/A';
        console.log(`${i + 1}. ${m.from}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
      });
      if (data.length > 10) console.log(`... and ${data.length - 10} more`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  },
  
  async send(id, phone, message) {
    const data = await fetchCRM('POST', '/api/crm/messages/send', {
      sessionId: id,
      phone,
      message
    });
    console.log(`\n📤 Message sent to ${phone}:`);
    console.log(JSON.stringify(data, null, 2));
  },
  
  async ws() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║           WebSocket 連接信息 / WebSocket Connection        ║
╠══════════════════════════════════════════════════════════╣
🔗 連接地址: wss://${CRM_BASE_URL}

📥 接收事件:
   { type: 'new_message', sessionId, chatId, message }
   { type: 'typing', sessionId, chatId, isTyping }
   { type: 'read_receipt', sessionId, chatId, messageIds }
   { type: 'media_downloaded', sessionId, messageId, filename }

📤 發送事件:
   { type: 'typing', sessionId, chatId, isTyping: true/false }
   { type: 'mark_read', sessionId, chatId, messageIds: [...] }

📝 JavaScript 範例:
   const ws = new WebSocket('wss://${CRM_BASE_URL}');
   ws.onopen = () => console.log('Connected');
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
╚══════════════════════════════════════════════════════════╝
`);
  }
};

// Main
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (!cmd || cmd === '--help') {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     WhatsApp CRM CLI / WhatsApp CRM 命令列工具            ║
╠══════════════════════════════════════════════════════════╣

Usage: whatsapp-crm <command> [args]

Sessions:
  sessions                    列出所有 sessions
  status <id>                 獲取 session 狀態
  start <id>                  啟動 session
  restart <id>                重啟 session
  logout <id>                 登出 session
  qr <id>                     獲取 QR code

Contacts:
  contacts <id>               列出聯絡人

Messages:
  messages <id> <jid>         獲取訊息
  send <id> <phone> <msg>    發送訊息

WebSocket:
  ws                          顯示 WebSocket 連接信息

Examples:
  whatsapp-crm sessions
  whatsapp-crm status my-session
  whatsapp-crm start my-session
  whatsapp-crm contacts my-session
  whatsapp-crm send my-session +85212345678 "Hello!"
  whatsapp-crm ws

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
    await handler(args[1], args[2], args[3]);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
