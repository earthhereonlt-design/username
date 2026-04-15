import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { generateUsernames, checkInstagram } from './src/generator.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Telegram Bot Setup
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    const bot = new TelegramBot(token, { polling: true });
    
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, 'Welcome! \n/generate - Get all usernames\n/check - Check Instagram availability');
    });

    bot.onText(/\/generate/, (msg) => {
      const chatId = msg.chat.id;
      const usernames = generateUsernames();
      bot.sendMessage(chatId, usernames.join('\n'));
    });

    bot.onText(/\/check/, async (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, 'Checking Instagram availability... (this may take a moment)');
      
      const usernames = generateUsernames();
      const results = [];
      
      for (const username of usernames) {
        const result = await checkInstagram(username);
        if (result.available) {
          results.push(`✅ ${username}`);
        } else {
          results.push(`❌ ${username}`);
        }
      }
      
      bot.sendMessage(chatId, `Instagram Availability:\n\n${results.join('\n')}`);
    });

    console.log('Telegram bot is running...');
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not found. Bot functionality disabled.');
  }

  // Health check endpoint
  app.get('/', (req, res) => {
    res.send('Telegram Bot is running.');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
