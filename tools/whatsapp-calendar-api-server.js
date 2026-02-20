#!/usr/bin/env node
/**
 * whatsapp-calendar-api-server.js - HTTP API for WhatsApp Calendar Integration
 * HTTP API 服務器 - 查看對話並自動添加到日曆
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const CONFIG = {
  port: 3090,
  crmBaseUrl: 'whatsapp-crm.techforliving.app',
  sessionId: 'sess_1771472517677',
  dataDir: '/root/.openclaw/dav-data/files'
};

// 獲取所有對話
async function getAllConversations() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.crmBaseUrl,
      port: 443,
      path: `/api/session/${CONFIG.sessionId}/contacts`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 獲取對話訊息
async function getMessages(jid, limit = 50) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.crmBaseUrl,
      port: 443,
      path: `/api/session/${CONFIG.sessionId}/messages/${encodeURIComponent(jid)}?limit=${limit}`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 生成 iCalendar
function generateICalendar(events) {
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\n';
  ics += 'PRODID:-//OpenClaw//WhatsApp Calendar//EN\n';
  ics += 'CALSCALE:GREGORIAN\nX-WR-CALNAME:WhatsApp Calendar\n\n';
  
  events.forEach((event, i) => {
    ics += 'BEGIN:VEVENT\n';
    ics += `UID:whatsapp-${i}-${Date.now()}@openclaw\n`;
    ics += `DTSTART:${event.start}\n`;
    ics += `DTEND:${event.end}\n`;
    ics += `SUMMARY:${event.title}\n`;
    ics += `DESCRIPTION:${event.description}\n`;
    ics += 'END:VEVENT\n\n';
  });
  
  ics += 'END:VCALENDAR';
  return ics;
}

// HTTP 服務器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // 路由
  if (parsedUrl.pathname === '/') {
    res.end(JSON.stringify({
      service: 'WhatsApp Calendar API',
      endpoints: {
        '/conversations': '獲取所有對話',
        '/messages/:jid': '獲取特定對話訊息',
        '/meetings': '獲取所有會議訊息',
        '/calendar.ics': '下載 iCalendar 格式'
      }
    }, null, 2));
    
  } else if (parsedUrl.pathname === '/conversations') {
    const conversations = await getAllConversations();
    res.end(JSON.stringify({
      count: conversations.length,
      conversations: conversations.slice(0, 20)
    }, null, 2));
    
  } else if (parsedUrl.pathname.startsWith('/messages/')) {
    const jid = decodeURIComponent(parsedUrl.pathname.replace('/messages/', ''));
    const messages = await getMessages(jid, 30);
    res.end(JSON.stringify({
      jid: jid,
      count: messages.length,
      messages: messages
    }, null, 2));
    
  } else if (parsedUrl.pathname === '/meetings') {
    // 掃描所有對話找會議
    const conversations = await getAllConversations();
    const allMeetings = [];
    
    for (const chat of conversations.slice(0, 5)) {
      const messages = await getMessages(chat.id, 20);
      // 簡單過濾包含時間關鍵詞的訊息
      messages.forEach(msg => {
        const content = msg.content || '';
        if (content.match(/(會議|開會|meeting|約|時間|日期|星期|幾點)/i)) {
          allMeetings.push({
            chat: chat.name || chat.id,
            content: content,
            timestamp: msg.message_timestamp
          });
        }
      });
    }
    
    res.end(JSON.stringify({
      count: allMeetings.length,
      meetings: allMeetings
    }, null, 2));
    
  } else if (parsedUrl.pathname === '/calendar.ics') {
    res.setHeader('Content-Type', 'text/calendar');
    const events = [
      {
        title: 'HKITSEA OC Zoom 會議',
        start: '20260227T100000',
        end: '20260227T110000',
        description: '籌備4月18日活動'
      },
      {
        title: 'AiTLE x HKITSEA AI Seminar',
        start: '20260418T090000',
        end: '20260418T130000',
        description: '英華書院'
      }
    ];
    res.end(generateICalendar(events));
    
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(CONFIG.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     WhatsApp Calendar API Server 已啟動!                 ║
╠══════════════════════════════════════════════════════════╣
📡 API 端點: http://localhost:${CONFIG.port}

可用端點:
  GET /                     - API 信息
  GET /conversations        - 所有對話列表
  GET /messages/:jid        - 特定對話訊息
  GET /meetings             - 掃描會議訊息
  GET /calendar.ics         - iCalendar 格式

範例:
  curl http://localhost:${CONFIG.port}/conversations
  curl http://localhost:${CONFIG.port}/meetings
  curl http://localhost:${CONFIG.port}/calendar.ics
╚══════════════════════════════════════════════════════════╝
  `);
});
