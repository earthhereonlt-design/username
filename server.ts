import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { generateUsernamesWithAI, checkInstagram } from './src/generator.ts';

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
    bot.sendMessage(msg.chat.id, 'Welcome! \n/run - Start continuous AI scanning\n/stop - Stop scanning immediately');
  });

  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    if (activeTasks.get(chatId)) {
      activeTasks.set(chatId, false);
      bot.sendMessage(chatId, '🛑 Stopping process immediately...');
    } else {
      bot.sendMessage(chatId, 'No active process to stop.');
    }
  });

  bot.onText(/\/run/, async (msg) => {
    const chatId = msg.chat.id;
    if (activeTasks.get(chatId)) {
      bot.sendMessage(chatId, '⚠️ Process is already running.');
      return;
    }

    activeTasks.set(chatId, true);
    bot.sendMessage(chatId, '🚀 Starting continuous AI scan...\nPattern: adi/aadi + . / _ + 2 letters\nUse /stop to terminate.');

    let totalChecked = 0;
    let totalTaken = 0;

    while (activeTasks.get(chatId)) {
      try {
        // Generate 25 usernames via Gemini
        const usernames = await generateUsernamesWithAI();
        if (usernames.length === 0) {
          bot.sendMessage(chatId, '⚠️ AI failed to generate usernames. Retrying in 30s...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        for (const username of usernames) {
          if (!activeTasks.get(chatId)) break;

          const result = await checkInstagram(username);
          
          if (result.rateLimited) {
            const pauseTime = 60000 + Math.random() * 60000; // 60-120s
            bot.sendMessage(chatId, `⚠️ Rate limited. Pausing for ${Math.round(pauseTime/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
            continue;
          }

          totalChecked++;
          if (result.available) {
            bot.sendMessage(chatId, `✅ Available: ${username}`);
          } else {
            totalTaken++;
          }

          // Random delay 3-7 seconds
          const delay = 3000 + Math.random() * 4000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (activeTasks.get(chatId)) {
          bot.sendMessage(chatId, `📊 Stats | Checked: ${totalChecked} | Taken: ${totalTaken}`);
        }
      } catch (error) {
        console.error('Loop Error:', error);
        if (activeTasks.get(chatId)) {
          bot.sendMessage(chatId, '❌ Network error. Retrying in 10s...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    bot.sendMessage(chatId, '🏁 Process terminated.');
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
