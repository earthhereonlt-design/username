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
  
  // Local generator as fallback - Improved with common aesthetic suffixes
  const generateLocally = () => {
    const results: string[] = [];
    // Aesthetic 2-letter combos common in high-value usernames
    const commonSuffixes = ['io', 'hq', 'ly', 'fx', 'me', 'it', 'up', 'xo', 'tv', 'go', 'ai', 'ux', 'dr', 'my', 'st'];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < 25; i++) {
      const base = BASES[Math.floor(Math.random() * BASES.length)];
      const sep = SEPARATORS[Math.floor(Math.random() * SEPARATORS.length)];
      
      // 40% chance of using an "aesthetic" suffix, 60% chance of pure random
      const useCommon = Math.random() < 0.4;
      const suffix = useCommon 
        ? commonSuffixes[Math.floor(Math.random() * commonSuffixes.length)]
        : alphabet[Math.floor(Math.random() * 26)] + alphabet[Math.floor(Math.random() * 26)];
      
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
  - Suffix: Exactly 2 lowercase letters (a-z). Prefer combinations that sound aesthetic or are common in web culture (e.g., io, ly, hq, fx).
  - Total length: Must be exactly 6 or 7 characters.

  Example Output:
  adi.io
  aadi_ly
  adi_hq
  aadi.fx`;

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

export interface CheckResult {
  username: string;
  available: boolean;
  rateLimited: boolean;
  unknown: boolean;
}

/**
 * Checks if a username is likely available on Instagram.
 * Uses content validation as status codes alone can be misleading.
 */
export async function checkInstagram(username: string): Promise<CheckResult> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (AppleChromebook) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.160 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36'
  ];

  const backoffs = [5000, 15000, 30000];
  let attempt = 0;

  while (attempt <= backoffs.length) {
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    const timestamp = new Date().toISOString();

    try {
      // Random jitter before starting an attempt
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const url = `https://www.instagram.com/${username}/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': randomUA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (response.status === 429) {
        console.log(`[${timestamp}] [CHECK] ⚠️  ${username} -> RATE LIMITED (429)`);
        return { username, available: false, rateLimited: true, unknown: true };
      }

      if (response.status === 400 || (response.status >= 300 && response.status < 400)) {
        if (attempt < backoffs.length) {
          const wait = backoffs[attempt];
          console.log(`[${timestamp}] [CHECK] ⚠️  ${username} -> HTTP ${response.status}. Retrying in ${wait / 1000}s... (Attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, wait));
          attempt++;
          continue;
        } else {
          console.log(`[${timestamp}] [CHECK] ⚠️  ${username} -> Repeated HTTP ${response.status}. Treatment as block.`);
          return { username, available: false, rateLimited: true, unknown: true };
        }
      }

      const body = await response.text();
      
      // Content Validation Logic
      const isNotFoundMsg = body.includes("Sorry, this page isn't available") || body.includes("Page Not Found");
      const hasProfileMeta = body.includes("profilePage_") || body.includes("username") || body.includes("\"biography\"");
      
      const available = isNotFoundMsg || response.status === 404;
      const taken = hasProfileMeta || response.status === 200;

      if (available && !taken) {
        console.log(`[${timestamp}] [CHECK] ✅ ${username} (Detected as AVAILABLE via Content)`);
        return { username, available: true, rateLimited: false, unknown: false };
      }

      if (taken) {
        console.log(`[${timestamp}] [CHECK] ❌ ${username} (Detected as TAKEN via Content)`);
        return { username, available: false, rateLimited: false, unknown: false };
      }

      // If ambiguous
      console.log(`[${timestamp}] [CHECK] ❓ ${username} -> Ambiguous response. Treating as unknown.`);
      return { username, available: false, rateLimited: false, unknown: true };

    } catch (error: any) {
      console.error(`[${timestamp}] [CHECK] 💥 Error checking ${username}:`, error.message);
      if (attempt < backoffs.length) {
        const wait = backoffs[attempt];
        await new Promise(resolve => setTimeout(resolve, wait));
        attempt++;
        continue;
      }
      return { username, available: false, rateLimited: false, unknown: true };
    }
  }

  return { username, available: false, rateLimited: false, unknown: true };
}
