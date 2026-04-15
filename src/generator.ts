/**
 * Username generation logic based on strict rules.
 */

import { GoogleGenAI } from "@google/genai";

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

  const genAI = new GoogleGenAI({ apiKey });
  // Using the recommended model from the skill
  const model = "gemini-2.0-flash";

  const prompt = `Generate exactly 25 unique usernames.
  Rules:
  - Must start with "adi" or "aadi".
  - Must contain exactly ONE separator: "_" or ".".
  - Total length must be 6 or 7 characters.
  - After the separator, there must be exactly 2 lowercase letters.
  - No numbers, no extra words, no extensions.
  - Format: Output ONLY the usernames, one per line.
  - Examples: adi_xy, adi.ab, aadi_qr.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }]
    });

    const text = response.text || "";
    return text.split('\n')
      .map(u => u.trim().toLowerCase())
      .filter(u => {
        // Validation logic
        const hasBase = u.startsWith('adi') || u.startsWith('aadi');
        const hasOneSep = (u.match(/[._]/g) || []).length === 1;
        const parts = u.split(/[._]/);
        const validSuffix = parts.length === 2 && /^[a-z]{2}$/.test(parts[1]);
        const validLength = u.length >= 6 && u.length <= 7;
        return hasBase && hasOneSep && validSuffix && validLength;
      })
      .slice(0, 25);
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return [];
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
