/**
 * Username generation logic based on strict rules.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const BASES = ['adi', 'aadi'];
export const SEPARATORS = ['.', '_'];

/**
 * Generates 25 usernames using Gemini API based on strict rules.
 */
export async function generateUsernamesWithAI(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Local generator as fallback
  const generateLocally = () => {
    const results: string[] = [];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < 25; i++) {
      const base = BASES[Math.floor(Math.random() * BASES.length)];
      const sep = SEPARATORS[Math.floor(Math.random() * SEPARATORS.length)];
      const suffix = alphabet[Math.floor(Math.random() * 26)] + alphabet[Math.floor(Math.random() * 26)];
      results.push(`${base}${sep}${suffix}`);
    }
    return results;
  };

  if (!apiKey) {
    console.log(`[${new Date().toISOString()}] [GEN] GEMINI_API_KEY not found. Using local fallback...`);
    return generateLocally();
  }

  console.log(`[${new Date().toISOString()}] [GEN] Requesting 25 usernames from Gemini...`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Task: Generate exactly 25 unique usernames.
  Strict Formatting Rules:
  - Each username must be on a new line.
  - DO NOT use bullets, numbers, or dashes.
  - DO NOT include any text other than the usernames.

  Generation Pattern:
  - Base: Must start with "adi" or "aadi".
  - Separator: Must have exactly ONE "." or "_".
  - Suffix: Exactly 2 lowercase letters (a-z).
  - Total length: Must be exactly 6 or 7 characters.

  Example Output:
  adi.ab
  aadi_xy
  adi_qw
  aadi.zz`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      console.warn("Gemini returned empty text.");
      return [];
    }

    const lines = text.split('\n');
    const filtered = lines
      .map(u => u.trim().replace(/^[-*•]\s+/, '').toLowerCase()) // Remove bullets if any
      .filter(u => {
        // Strict Validation logic
        const hasBase = u.startsWith('adi') || u.startsWith('aadi');
        const hasOneSep = (u.match(/[._]/g) || []).length === 1;
        const parts = u.split(/[._]/);
        const validSuffix = parts.length === 2 && /^[a-z]{2}$/.test(parts[1]);
        const validLength = u.length >= 6 && u.length <= 7;
        return hasBase && hasOneSep && validSuffix && validLength;
      })
      .slice(0, 25);

    if (filtered.length === 0) {
      console.log(`[${new Date().toISOString()}] [GEN] Gemini results failed validation. Using local fallback.`);
      return generateLocally();
    }

    console.log(`[${new Date().toISOString()}] [GEN] Successfully received ${filtered.length} valid usernames from AI.`);
    return filtered;
  } catch (error: any) {
    // Check for API key errors specifically
    if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('key not valid')) {
      console.error(`[${new Date().toISOString()}] [AUTH] CRITICAL: Invalid API Key.`);
      throw new Error(`CRITICAL_AUTH: ${error.message}`);
    }

    // If it's a rate limit or any other error, use local generator to keep the bot moving
    console.log(`[${new Date().toISOString()}] [GEN] Gemini error (Rate limit or network). Falling back to local...`);
    return generateLocally();
  }
}

/**
 * Checks if a username is likely available on Instagram.
 */
export async function checkInstagram(username: string): Promise<{ username: string; available: boolean; rateLimited?: boolean }> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
  ];

  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

  try {
    // Adding a random delay within the check to simulate human thinking/typing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

    const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`; // Using internal param hints
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': randomUA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459', // Common public IG app ID
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const timestamp = new Date().toISOString();

    if (response.status === 429) {
      console.log(`[${timestamp}] [CHECK] ⚠️  ${username} -> RATE LIMITED (429)`);
      return { username, available: false, rateLimited: true };
    }

    const available = response.status === 404;
    const statusIcon = available ? '✅' : '❌';
    console.log(`[${timestamp}] [CHECK] ${statusIcon} ${username} (HTTP ${response.status})`);
    
    return { username, available };
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] [CHECK] Error checking ${username}:`, error.message);
    return { username, available: false };
  }
}
