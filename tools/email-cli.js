#!/usr/bin/env node
/**
 * email-cli.js - Email Management CLI
 * 郵件管理命令列工具
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CONFIG_FILE = path.join(process.env.HOME || '/root', '.email-config.json');

// 讀取配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return { accounts: [], settings: {} };
}

// 保存配置
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 顯示幫助
function showHelp() {
  console.log(`
📧 Email Manager / 郵件管理

用法: email <command> [options]

指令:
  setup                    設置郵件帳號
  add-gmail               添加 Gmail 帳號
  add-imap                添加 IMAP 郵箱
  list                    列出所有郵箱
  inbox [account]         查看收件箱
  send                    發送郵件
  search <query>          搜尋郵件
  unread                  查看未讀郵件
  summary                 郵件摘要

範例:
  email setup
  email add-gmail
  email inbox gmail --limit 10
  email send --to "test@example.com" --subject "Hello"
  email search "會議" --from "boss@company.com"
`);
}

// 設置嚮導
async function setup() {
  console.log('📧 郵件管理設置\n');
  console.log('請選擇郵箱類型：');
  console.log('1. Gmail (推薦)');
  console.log('2. Microsoft 365 / Outlook');
  console.log('3. 公司 IMAP 郵箱');
  console.log('4. 其他 IMAP 郵箱\n');
  console.log('請運行相應指令：');
  console.log('  email add-gmail');
  console.log('  email add-microsoft');
  console.log('  email add-imap\n');
}

// 添加 Gmail
function addGmail() {
  console.log(`
📧 添加 Gmail 帳號

步驟：
1. 前往 https://console.cloud.google.com/
2. 創建項目並啟用 Gmail API
3. 創建 OAuth 2.0 憑證（Desktop app）
4. 下載 credentials.json

授權 URL:
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/gmail.modify&response_type=code&access_type=offline

獲取 code 後運行：
  email auth-gmail --code YOUR_CODE
`);
}

// 添加 IMAP
function addImap() {
  console.log(`
📧 添加 IMAP 郵箱

需要提供以下信息：
- 郵箱名稱（例如：公司郵箱）
- 郵箱地址
- IMAP 伺服器地址
- IMAP 端口（通常是 993）
- SMTP 伺服器地址
- SMTP 端口（通常是 587）
- 密碼（或應用專用密碼）

範例：
  email add-imap \\
    --name "公司郵箱" \\
    --email "you@company.com" \\
    --imap-host "imap.company.com" \\
    --smtp-host "smtp.company.com" \\
    --password "your-password"
`);
}

// 列出郵箱
function listAccounts() {
  const config = loadConfig();
  
  if (config.accounts.length === 0) {
    console.log('❌ 尚未設置任何郵箱');
    console.log('請運行: email setup');
    return;
  }
  
  console.log('\n📧 已設置的郵箱:\n');
  config.accounts.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.name}`);
    console.log(`   類型: ${acc.type}`);
    console.log(`   郵箱: ${acc.email}`);
    console.log('');
  });
}

// 查看收件箱
async function showInbox(accountName, limit = 10) {
  console.log(`📧 正在獲取收件箱...\n`);
  
  // 這裡需要實際的 IMAP/SMTP 實現
  // 暫時顯示模擬數據
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  📧 收件箱 (模擬數據)                                     ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('1. [未讀] 會議通知 - boss@company.com');
  console.log('   明天下午3點項目進度會議...');
  console.log('   時間: 2026-02-21 10:30\n');
  console.log('2. [已讀] 發票確認 - billing@service.com');
  console.log('   您的月度發票已生成...');
  console.log('   時間: 2026-02-20 18:00\n');
  console.log('3. [未讀] 活動邀請 - events@hkitsea.hk');
  console.log('   HKITSEA 4月18日活動邀請...');
  console.log('   時間: 2026-02-20 15:00\n');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n💡 提示：這是模擬數據。要連接真實郵箱，需要：');
  console.log('   1. 設置 OAuth2 或 IMAP 認證');
  console.log('   2. 安裝郵件處理庫（如 imap-simple, nodemailer）');
}

// 主函數
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'setup':
      setup();
      break;
    case 'add-gmail':
      addGmail();
      break;
    case 'add-imap':
      addImap();
      break;
    case 'list':
      listAccounts();
      break;
    case 'inbox':
      showInbox(args[1]);
      break;
    case 'help':
    default:
      showHelp();
  }
}

main();
