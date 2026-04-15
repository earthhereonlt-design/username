/**
 * Username generation logic based on strict rules.
 */

export const BASES = ['adi', 'aadi'];
export const EXTENSIONS = ['php', 'js', 'py', 'xp', 'io', 'oi'];
export const SEPARATORS = ['.', '_'];

export function generateUsernames(): string[] {
  const usernames: string[] = [];
  
  for (const base of BASES) {
    for (const ext of EXTENSIONS) {
      for (const sep of SEPARATORS) {
        usernames.push(`${base}${sep}${ext}`);
      }
    }
  }
  
  return usernames;
}

/**
 * Checks if a username is likely available on Instagram.
 */
export async function checkInstagram(username: string): Promise<{ username: string; available: boolean }> {
  try {
    const url = `https://www.instagram.com/${username}/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // Instagram returns 404 for available usernames
    return { username, available: response.status === 404 };
  } catch (error) {
    return { username, available: false };
  }
}
