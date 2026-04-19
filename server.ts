import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { generateUsernamesWithAI, checkInstagram } from './src/generator';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Telegram Bot Setup
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not found. Bot functionality disabled.');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  const activeTasks = new Map<number, boolean>();

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
      '<b>🚀 Minimal Username Bot</b>\n\n' +
      'Use the commands below to control the scanner:\n\n' +
      '▶️ /run - Start continuous AI scanning\n' +
      '🛑 /stop - Stop scanning immediately\n\n' +
      '<i>Pattern: adi/aadi + . / _ + 2 letters</i>', 
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (activeTasks.get(chatId)) {
      activeTasks.set(chatId, false);
      bot.sendMessage(chatId, '<b>🛑 Stopping process...</b>\nThe scanner will terminate after the current check.', { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, '❌ No active process to stop.', { parse_mode: 'HTML' });
    }
  });

  bot.onText(/\/run/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[Bot] Received /run from chatId: ${chatId}`);
    if (activeTasks.get(chatId)) {
      bot.sendMessage(chatId, '⚠️ <b>Process is already running.</b>', { parse_mode: 'HTML' });
      return;
    }

    activeTasks.set(chatId, true);
    const statusMsg = await bot.sendMessage(chatId, 
      '<b>⚡ Scanner v3 Initialized</b>\n' +
      '--------------------------\n' +
      '🔍 Preparing first batch...\n' +
      '--------------------------', 
      { parse_mode: 'HTML' }
    );

    let totalChecked = 0;
    let totalTaken = 0;
    let totalFound = 0;
    let consecutiveErrors = 0;

    const updateStatus = async (currentUsername: string) => {
      try {
        const errorIndicator = consecutiveErrors > 0 ? ` (⚠️ Errors: ${consecutiveErrors})` : '';
        await bot.editMessageText(
          `<b>🚀 Scanner v3 Active</b>\n` +
          `--------------------------\n` +
          `👤 <b>Checking:</b> <code>${currentUsername}</code>\n` +
          `✅ <b>Total Checked:</b> ${totalChecked}\n` +
          `❌ <b>Taken:</b> ${totalTaken}\n` +
          `✨ <b>Found:</b> ${totalFound}${errorIndicator}\n` +
          `--------------------------\n` +
          `<i>Editing this message to save space...</i>`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'HTML'
          }
        );
      } catch (e) {
        // Ignore edit errors
      }
    };

    while (activeTasks.get(chatId)) {
      try {
        const usernames = await generateUsernamesWithAI();
        console.log(`[${new Date().toISOString()}] [LOOP] Processing new batch of ${usernames.length} candidates.`);

        for (const username of usernames) {
          if (!activeTasks.get(chatId)) break;

          await updateStatus(username);

          const result = await checkInstagram(username);
          
          if (result.rateLimited) {
            consecutiveErrors++;
            
            // If we hit too many errors (400/302/429), take a long break
            const pauseTime = consecutiveErrors >= 3 
              ? (600000 + Math.random() * 600000) // 10-20 min break
              : (120000 + Math.random() * 120000); // 2-4 min break

            const waitMsg = consecutiveErrors >= 3 
              ? `🚨 <b>Critical Block Detected</b>\nToo many warnings received. Resting for ${Math.round(pauseTime/60000)} minutes to clear IP flag...`
              : `⏳ <b>Soft Rate Limit</b>\nInstagram is suspicious. Pausing for ${Math.round(pauseTime/1000)}s...`;

            console.log(`[${new Date().toISOString()}] [LOOP] 🛑 Blocked. Cooling down for ${Math.round(pauseTime/1000)}s. Error count: ${consecutiveErrors}`);
            bot.sendMessage(chatId, waitMsg, { parse_mode: 'HTML' });
            
            await new Promise(resolve => setTimeout(resolve, pauseTime));
            continue;
          }

          if (result.unknown) {
            console.log(`[${new Date().toISOString()}] [LOOP] ❓ ${username} result is unknown/ambiguous. Skipping...`);
            continue;
          }

          // Reset error count on successful check
          consecutiveErrors = 0;

          totalChecked++;
          if (result.available) {
            totalFound++;
            console.log(`[${new Date().toISOString()}] [FOUND] ⭐ ${username} is AVAILABLE!`);
            bot.sendMessage(chatId, 
              `✨ <b>AVAILABLE FOUND!</b>\n` +
              `--------------------------\n` +
              `👤 <b>Username:</b> <code>${username}</code>\n` +
              `🔗 <a href="https://instagram.com/${username}">Open Instagram</a>\n` +
              `--------------------------`, 
              { parse_mode: 'HTML', disable_web_page_preview: true }
            );
          } else {
            totalTaken++;
          }

          // Safe delay between checks
          const delay = 10000 + Math.random() * 8000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Batch rest to let the IP cool down after 25 checks
        if (activeTasks.get(chatId)) {
          console.log(`[${new Date().toISOString()}] [LOOP] Batch complete. Resting for 60s...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      } catch (error: any) {
        console.error('Loop Error:', error);
        
        const isAuthError = error?.message?.includes('CRITICAL_AUTH');
        const is429 = error?.status === 429 || error?.response?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RETRY_429');
        
        if (activeTasks.get(chatId)) {
          let message = '❌ <b>Unexpected Network Error</b>\nRetrying in 30s...';
          let waitTime = 30000;

          if (isAuthError) {
            message = '🚫 <b>API Key Error</b>\nYour Gemini API key is invalid or expired. Please check your AI Studio secrets.';
            activeTasks.set(chatId, false); // Stop the task if it's an auth error
            waitTime = 0;
          } else if (is429) {
            message = '⚠️ <b>AI Rate Limit Hit</b>\nToo many requests to Gemini. Pausing for 5 minutes to reset quota...';
            waitTime = 300000;
          }
          
          bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
          if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    bot.sendMessage(chatId, '🏁 <b>Process Terminated.</b>', { parse_mode: 'HTML' });
  });

  // Health check endpoint
  app.get('/', (req, res) => {
    res.send('Telegram Bot is running.');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
