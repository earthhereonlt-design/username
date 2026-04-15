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
    bot.sendMessage(chatId, 
      '<b>⚡ Scanner Started</b>\n' +
      '--------------------------\n' +
      '🔍 <b>Target:</b> Instagram\n' +
      '🤖 <b>AI:</b> Gemini 2.0 Flash\n' +
      '--------------------------\n' +
      '<i>Continuous scanning initiated...</i>', 
      { parse_mode: 'HTML' }
    );

    let totalChecked = 0;
    let totalTaken = 0;
    let totalFound = 0;

    while (activeTasks.get(chatId)) {
      try {
        const usernames = await generateUsernamesWithAI();
        console.log(`[AI] Generated ${usernames.length} usernames for chatId: ${chatId}`);
        if (usernames.length === 0) {
          bot.sendMessage(chatId, '⏳ <i>AI failed to generate. Retrying in 30s...</i>', { parse_mode: 'HTML' });
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        for (const username of usernames) {
          if (!activeTasks.get(chatId)) break;

          const result = await checkInstagram(username);
          
          if (result.rateLimited) {
            const pauseTime = 60000 + Math.random() * 60000;
            bot.sendMessage(chatId, `⏳ <b>Rate Limited</b>\nPausing for ${Math.round(pauseTime/1000)}s to avoid block...`, { parse_mode: 'HTML' });
            await new Promise(resolve => setTimeout(resolve, pauseTime));
            continue;
          }

          totalChecked++;
          if (result.available) {
            totalFound++;
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

          const delay = 3000 + Math.random() * 4000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (activeTasks.get(chatId)) {
          bot.sendMessage(chatId, 
            `📊 <b>Session Stats</b>\n` +
            `--------------------------\n` +
            `✅ Checked: <b>${totalChecked}</b>\n` +
            `❌ Taken: <b>${totalTaken}</b>\n` +
            `🎁 Found: <b>${totalFound}</b>\n` +
            `--------------------------`, 
            { parse_mode: 'HTML' }
          );
        }
      } catch (error) {
        console.error('Loop Error:', error);
        if (activeTasks.get(chatId)) {
          bot.sendMessage(chatId, '❌ <b>Network error.</b> Retrying in 10s...', { parse_mode: 'HTML' });
          await new Promise(resolve => setTimeout(resolve, 10000));
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
