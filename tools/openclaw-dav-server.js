#!/usr/bin/env node
/**
 * openclaw-dav-server.js - CalDAV/CardDAV/WebDAV/HTTP Server
 * 完整的 DAV 服務器，支援日曆、聯絡人、檔案同步
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CONFIG = {
  port: 3080,
  httpsPort: 3443,
  dataDir: '/root/.openclaw/dav-data',
  ssl: {
    key: '/root/.openclaw/dav-data/key.pem',
    cert: '/root/.openclaw/dav-data/cert.pem'
  },
  auth: {
    username: 'admin',
    password: 'openclaw123'
  }
};

// 確保數據目錄存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(CONFIG.dataDir);
ensureDir(path.join(CONFIG.dataDir, 'calendars'));
ensureDir(path.join(CONFIG.dataDir, 'contacts'));
ensureDir(path.join(CONFIG.dataDir, 'files'));

// 基本認證
function checkAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="OpenClaw DAV"');
    res.writeHead(401);
    res.end('Authentication required');
    return false;
  }
  
  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');
  
  if (user !== CONFIG.auth.username || pass !== CONFIG.auth.password) {
    res.writeHead(403);
    res.end('Invalid credentials');
    return false;
  }
  
  return true;
}

// 生成 DAV XML 響應
function generateMultistatus(resources) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:card="urn:ietf:params:xml:ns:carddav">\n';
  
  resources.forEach(r => {
    xml += '  <d:response>\n';
    xml += `    <d:href>${r.href}</d:href>\n`;
    xml += '    <d:propstat>\n';
    xml += '      <d:prop>\n';
    if (r.displayname) xml += `        <d:displayname>${r.displayname}</d:displayname>\n`;
    if (r.resourcetype) xml += `        <d:resourcetype>${r.resourcetype}</d:resourcetype>\n`;
    if (r.getcontenttype) xml += `        <d:getcontenttype>${r.getcontenttype}</d:getcontenttype>\n`;
    if (r.getetag) xml += `        <d:getetag>${r.getetag}</d:getetag>\n`;
    xml += '      </d:prop>\n';
    xml += '      <d:status>HTTP/1.1 200 OK</d:status>\n';
    xml += '    </d:propstat>\n';
    xml += '  </d:response>\n';
  });
  
  xml += '</d:multistatus>';
  return xml;
}

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, REPORT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 認證
  if (!checkAuth(req, res)) return;
  
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  
  // 路由
  if (parsedUrl.pathname === '/') {
    handleRoot(req, res);
  } else if (parsedUrl.pathname.startsWith('/.well-known/acme-challenge/')) {
    // Let's Encrypt 驗證
    handleACMEChallenge(req, res, parsedUrl);
  } else if (parsedUrl.pathname.startsWith('/calendars')) {
    handleCalDAV(req, res, parsedUrl);
  } else if (parsedUrl.pathname.startsWith('/contacts')) {
    handleCardDAV(req, res, parsedUrl);
  } else if (parsedUrl.pathname.startsWith('/files')) {
    handleWebDAV(req, res, parsedUrl);
  } else if (parsedUrl.pathname.startsWith('/api/')) {
    handleAPI(req, res, parsedUrl);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// 根目錄
function handleRoot(req, res) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OpenClaw DAV Server</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
    code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>📁 OpenClaw DAV Server</h1>
  <p>CalDAV / CardDAV / WebDAV / HTTP API Server</p>
  
  <div class="endpoint">
    <h3>📅 CalDAV - 日曆同步</h3>
    <code>http://YOUR_SERVER:3080/calendars/</code>
  </div>
  
  <div class="endpoint">
    <h3>👥 CardDAV - 聯絡人同步</h3>
    <code>http://YOUR_SERVER:3080/contacts/</code>
  </div>
  
  <div class="endpoint">
    <h3>📁 WebDAV - 檔案同步</h3>
    <code>http://YOUR_SERVER:3080/files/</code>
  </div>
  
  <div class="endpoint">
    <h3>🔌 HTTP API</h3>
    <code>http://YOUR_SERVER:3080/api/</code>
  </div>
  
  <p><strong>認證:</strong> Basic Auth (admin / openclaw123)</p>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(200);
  res.end(html);
}

// Let's Encrypt ACME Challenge 處理
function handleACMEChallenge(req, res, parsedUrl) {
  const challengeFile = path.join(CONFIG.dataDir, '.well-known', 'acme-challenge', path.basename(parsedUrl.pathname));
  
  if (req.method === 'GET' && fs.existsSync(challengeFile)) {
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(200);
    res.end(fs.readFileSync(challengeFile, 'utf8'));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// CalDAV 處理
function handleCalDAV(req, res, parsedUrl) {
  const calendarPath = path.join(CONFIG.dataDir, 'calendars');
  
  if (req.method === 'PROPFIND') {
    // 返回日曆列表
    const resources = [{
      href: '/calendars/',
      displayname: 'Calendars',
      resourcetype: '<d:collection/><cal:calendar/>'
    }, {
      href: '/calendars/default/',
      displayname: 'Default Calendar',
      resourcetype: '<d:collection/><cal:calendar/>'
    }];
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.writeHead(207);
    res.end(generateMultistatus(resources));
    
  } else if (req.method === 'GET') {
    // 返回日曆數據
    const filePath = path.join(calendarPath, 'default.ics');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/calendar');
      res.writeHead(200);
      res.end(fs.readFileSync(filePath));
    } else {
      // 返回示例日曆
      const ics = generateSampleCalendar();
      res.setHeader('Content-Type', 'text/calendar');
      res.writeHead(200);
      res.end(ics);
    }
    
  } else if (req.method === 'PUT') {
    // 保存日曆事件
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const filePath = path.join(calendarPath, 'default.ics');
      fs.writeFileSync(filePath, body);
      res.writeHead(201);
      res.end('Created');
    });
    
  } else if (req.method === 'REPORT') {
    // CalDAV 查詢
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.writeHead(207);
      res.end(generateMultistatus([{
        href: '/calendars/default/',
        displayname: 'Default Calendar',
        resourcetype: '<d:collection/><cal:calendar/>'
      }]));
    });
    
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
}

// CardDAV 處理
function handleCardDAV(req, res, parsedUrl) {
  const contactsPath = path.join(CONFIG.dataDir, 'contacts');
  
  if (req.method === 'PROPFIND') {
    const resources = [{
      href: '/contacts/',
      displayname: 'Contacts',
      resourcetype: '<d:collection/><card:addressbook/>'
    }];
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.writeHead(207);
    res.end(generateMultistatus(resources));
    
  } else if (req.method === 'GET') {
    const filePath = path.join(contactsPath, 'default.vcf');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/vcard');
      res.writeHead(200);
      res.end(fs.readFileSync(filePath));
    } else {
      res.setHeader('Content-Type', 'text/vcard');
      res.writeHead(200);
      res.end(generateSampleVCard());
    }
    
  } else if (req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const filePath = path.join(contactsPath, 'default.vcf');
      fs.writeFileSync(filePath, body);
      res.writeHead(201);
      res.end('Created');
    });
    
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
}

// WebDAV 處理
function handleWebDAV(req, res, parsedUrl) {
  const filesPath = path.join(CONFIG.dataDir, 'files');
  const targetPath = path.join(filesPath, decodeURIComponent(parsedUrl.pathname.replace('/files', '')));
  
  if (req.method === 'PROPFIND') {
    const resources = [];
    
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      resources.push({
        href: parsedUrl.pathname,
        displayname: path.basename(targetPath) || 'files',
        resourcetype: '<d:collection/>'
      });
      
      // 列出目錄內容
      try {
        fs.readdirSync(targetPath).forEach(file => {
          const fileStat = fs.statSync(path.join(targetPath, file));
          resources.push({
            href: path.join(parsedUrl.pathname, file),
            displayname: file,
            resourcetype: fileStat.isDirectory() ? '<d:collection/>' : '',
            getcontenttype: fileStat.isFile() ? 'application/octet-stream' : '',
            getetag: `"${fileStat.mtime.getTime()}"`
          });
        });
      } catch (e) {}
    }
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.writeHead(207);
    res.end(generateMultistatus(resources));
    
  } else if (req.method === 'GET') {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      res.writeHead(200);
      res.end(fs.readFileSync(targetPath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    
  } else if (req.method === 'PUT') {
    ensureDir(path.dirname(targetPath));
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFileSync(targetPath, body);
      res.writeHead(201);
      res.end('Created');
    });
    
  } else if (req.method === 'MKCOL') {
    ensureDir(targetPath);
    res.writeHead(201);
    res.end('Created');
    
  } else if (req.method === 'DELETE') {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true });
    }
    res.writeHead(204);
    res.end();
    
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
}

// HTTP API 處理
function handleAPI(req, res, parsedUrl) {
  res.setHeader('Content-Type', 'application/json');
  
  if (parsedUrl.pathname === '/api/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      server: 'OpenClaw DAV Server',
      version: '1.0.0',
      endpoints: {
        caldav: '/calendars/',
        carddav: '/contacts/',
        webdav: '/files/'
      }
    }, null, 2));
    
  } else if (parsedUrl.pathname === '/api/calendars' && req.method === 'GET') {
    // 返回日曆事件列表
    const events = loadCalendarEvents();
    res.writeHead(200);
    res.end(JSON.stringify(events, null, 2));
    
  } else if (parsedUrl.pathname === '/api/calendars' && req.method === 'POST') {
    // 創建日曆事件
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        saveCalendarEvent(event);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, event }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    
  } else if (parsedUrl.pathname === '/api/contacts' && req.method === 'GET') {
    const contacts = loadContacts();
    res.writeHead(200);
    res.end(JSON.stringify(contacts, null, 2));
    
  } else if (parsedUrl.pathname === '/api/contacts' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const contact = JSON.parse(body);
        saveContact(contact);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, contact }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// 輔助函數
function generateSampleCalendar() {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpenClaw//DAV Server//EN
BEGIN:VEVENT
UID:test-event-1@openclaw
DTSTART:20260226T190000Z
DTEND:20260226T200000Z
SUMMARY:測試會議
DESCRIPTION:這是一個測試事件
END:VEVENT
END:VCALENDAR`;
}

function generateSampleVCard() {
  return `BEGIN:VCARD
VERSION:3.0
FN:測試聯絡人
N:聯絡人;測試;;;
EMAIL:test@example.com
TEL:12345678
END:VCARD`;
}

function loadCalendarEvents() {
  const filePath = path.join(CONFIG.dataDir, 'calendars', 'events.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

function saveCalendarEvent(event) {
  const events = loadCalendarEvents();
  event.id = event.id || Date.now().toString();
  event.created = new Date().toISOString();
  events.push(event);
  const filePath = path.join(CONFIG.dataDir, 'calendars', 'events.json');
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
}

function loadContacts() {
  const filePath = path.join(CONFIG.dataDir, 'contacts', 'contacts.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

function saveContact(contact) {
  const contacts = loadContacts();
  contact.id = contact.id || Date.now().toString();
  contacts.push(contact);
  const filePath = path.join(CONFIG.dataDir, 'contacts', 'contacts.json');
  fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2));
}

// 確保 .well-known 目錄存在用於 Let's Encrypt
ensureDir(path.join(CONFIG.dataDir, '.well-known', 'acme-challenge'));

// 啟動 HTTP 服務器（包含 Let's Encrypt 驗證路徑）
server.listen(CONFIG.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     OpenClaw DAV Server 已啟動!                          ║
╠══════════════════════════════════════════════════════════╣
📅 CalDAV:   http://localhost:${CONFIG.port}/calendars/
👥 CardDAV:  http://localhost:${CONFIG.port}/contacts/
📁 WebDAV:   http://localhost:${CONFIG.port}/files/
🔌 HTTP API: http://localhost:${CONFIG.port}/api/
╠══════════════════════════════════════════════════════════╣
認證: admin / openclaw123
數據目錄: ${CONFIG.dataDir}
╚══════════════════════════════════════════════════════════╝
  `);
});

// 啟動 HTTPS 服務器
if (fs.existsSync(CONFIG.ssl.key) && fs.existsSync(CONFIG.ssl.cert)) {
  const httpsServer = https.createServer({
    key: fs.readFileSync(CONFIG.ssl.key),
    cert: fs.readFileSync(CONFIG.ssl.cert)
  }, (req, res) => {
    // 複用相同的處理邏輯
    const parsedUrl = url.parse(req.url, true);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, REPORT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // 認證
    if (!checkAuth(req, res)) return;
    
    console.log(`${new Date().toISOString()} [HTTPS] ${req.method} ${req.url}`);
    
    // 路由
    if (parsedUrl.pathname === '/') {
      handleRoot(req, res);
    } else if (parsedUrl.pathname.startsWith('/calendars')) {
      handleCalDAV(req, res, parsedUrl);
    } else if (parsedUrl.pathname.startsWith('/contacts')) {
      handleCardDAV(req, res, parsedUrl);
    } else if (parsedUrl.pathname.startsWith('/files')) {
      handleWebDAV(req, res, parsedUrl);
    } else if (parsedUrl.pathname.startsWith('/api/')) {
      handleAPI(req, res, parsedUrl);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  httpsServer.listen(CONFIG.httpsPort, () => {
    console.log(`
🔒 HTTPS Server 已啟動!
📅 CalDAV:   https://localhost:${CONFIG.httpsPort}/calendars/
👥 CardDAV:  https://localhost:${CONFIG.httpsPort}/contacts/
📁 WebDAV:   https://localhost:${CONFIG.httpsPort}/files/
🔌 HTTP API: https://localhost:${CONFIG.httpsPort}/api/
    `);
  });
}

// 處理退出
process.on('SIGINT', () => {
  console.log('\n👋 關閉服務器...');
  server.close();
  process.exit(0);
});
