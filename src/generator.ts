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

interface SessionContext {
  token: string | null;
  cookies: string | null;
  count: number;
  userAgent: string;
}

let currentSession: SessionContext | null = null;
const SESSION_LIMIT = 25;

/**
 * Initializes or refreshes the Instagram session to get fresh CSRF tokens and cookies.
 */
async function refreshSession(): Promise<boolean> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'
  ];
  
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] [SESSION] 🔄 Refreshing Instagram session...`);
    const response = await fetch('https://www.instagram.com/accounts/emailsignup/', {
      method: 'GET',
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) return false;

    // Extract CSRF token from cookies
    const tokenMatch = setCookie.match(/csrftoken=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    currentSession = {
      token,
      cookies: setCookie,
      count: 0,
      userAgent: ua
    };

    console.log(`[${timestamp}] [SESSION] ✅ Session established. Token: ${token ? 'Found' : 'Missing'}`);
    return true;
  } catch (err: any) {
    console.error(`[${timestamp}] [SESSION] 💥 Refresh failed:`, err.message);
    return false;
  }
}

/**
 * Checks if a username is available using the official signup validation endpoint.
 */
export async function checkInstagram(username: string): Promise<CheckResult> {
  const backoffs = [5000, 15000, 30000];
  let attempt = 0;

  while (attempt <= backoffs.length) {
    // Refresh session if needed
    if (!currentSession || currentSession.count >= SESSION_LIMIT || !currentSession.token) {
      const success = await refreshSession();
      if (!success) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempt++;
        continue;
      }
    }

    const { token, cookies, userAgent } = currentSession!;
    const timestamp = new Date().toISOString();

    try {
      // Small jitter
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const response = await fetch('https://www.instagram.com/api/v1/web/accounts/web_create_ajax/attempt/', {
        method: 'POST',
        headers: {
          'User-Agent': userAgent,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': token || '',
          'X-Instagram-AJAX': '1',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/accounts/emailsignup/',
          'Cookie': cookies || '',
        },
        body: new URLSearchParams({
          username: username,
          email: `${Math.random().toString(36).substring(7)}@gmail.com`,
          password: `pass_${Math.random().toString(36).substring(7)}`,
          first_name: 'User',
          opt_into_hashtags: 'false'
        }).toString()
      });

      currentSession!.count++;

      if (response.status === 429) {
        console.log(`[${timestamp}] [API] ⚠️  ${username} -> RATE LIMITED (429)`);
        return { username, available: false, rateLimited: true, unknown: true };
      }

      if (response.status === 400 || (response.status >= 300 && response.status < 400)) {
        if (attempt < backoffs.length) {
          const wait = backoffs[attempt];
          console.log(`[${timestamp}] [API] ⚠️  ${username} -> HTTP ${response.status}. Backing off ${wait/1000}s... (Attempt ${attempt+1})`);
          await new Promise(resolve => setTimeout(resolve, wait));
          attempt++;
          // Force session refresh on error
          currentSession = null;
          continue;
        } else {
          console.log(`[${timestamp}] [API] ⚠️  ${username} -> Critical Error ${response.status}. Scaling down.`);
          return { username, available: false, rateLimited: true, unknown: true };
        }
      }

      const data = await response.json();
      
      // Official Decision Logic
      if (data.status === 'ok') {
        const taken = data.errors?.username ? true : false;
        
        if (taken) {
          console.log(`[${timestamp}] [API] ❌ ${username} is TAKEN (Confirmed by API)`);
          return { username, available: false, rateLimited: false, unknown: false };
        } else {
          console.log(`[${timestamp}] [API] ✅ ${username} is AVAILABLE (Confirmed by API)`);
          return { username, available: true, rateLimited: false, unknown: false };
        }
      }

      console.warn(`[${timestamp}] [API] ❓ ${username} -> Unexpected JSON:`, JSON.stringify(data));
      return { username, available: false, rateLimited: false, unknown: true };

    } catch (error: any) {
      console.error(`[${timestamp}] [API] 💥 Check Error:`, error.message);
      if (attempt < backoffs.length) {
        await new Promise(resolve => setTimeout(resolve, backoffs[attempt]));
        attempt++;
        currentSession = null;
        continue;
      }
      return { username, available: false, rateLimited: false, unknown: true };
    }
  }

  return { username, available: false, rateLimited: false, unknown: true };
}
