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
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

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
      console.warn("AI generated content but none passed validation filter. Raw output:", text);
    }

    return filtered;
  } catch (error: any) {
    // If it's a rate limit error, rethrow it so the main loop can pause longer
    if (error?.status === 429 || error?.response?.status === 429 || error?.message?.includes('429')) {
      throw new Error(`RETRY_429: ${error.message || 'Rate limit exceeded'}`);
    }
    
    // Check for API key errors specifically
    if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('key not valid')) {
      throw new Error(`CRITICAL_AUTH: ${error.message}`);
    }

    console.error("Gemini Generation Error:", error);
    throw error; // Throw so server.ts can report the specific error
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
    const url = `https://www.instagram.com/${username}/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': randomUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.status === 429) {
      console.warn(`[Instagram] Rate limited (429) for ${username}`);
      return { username, available: false, rateLimited: true };
    }

    console.log(`[Instagram] Checked ${username} - Status: ${response.status}`);
    // Instagram returns 404 for available usernames
    return { username, available: response.status === 404 };
  } catch (error) {
    console.error(`Fetch error for ${username}:`, error);
    return { username, available: false };
  }
}
