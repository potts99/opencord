import { MAX_USERNAME_LENGTH, MAX_DISPLAY_NAME_LENGTH, MAX_CHANNEL_NAME_LENGTH, MAX_MESSAGE_LENGTH } from './constants';

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Invalid email format';
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username) return 'Username is required';
  if (username.length < 2) return 'Username must be at least 2 characters';
  if (username.length > MAX_USERNAME_LENGTH) return `Username must be at most ${MAX_USERNAME_LENGTH} characters`;
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username can only contain letters, numbers, hyphens, and underscores';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name) return 'Display name is required';
  if (name.length > MAX_DISPLAY_NAME_LENGTH) return `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`;
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export function validateChannelName(name: string): string | null {
  if (!name) return 'Channel name is required';
  if (name.length > MAX_CHANNEL_NAME_LENGTH) return `Channel name must be at most ${MAX_CHANNEL_NAME_LENGTH} characters`;
  return null;
}

export function validateMessage(content: string): string | null {
  if (!content || !content.trim()) return 'Message cannot be empty';
  if (content.length > MAX_MESSAGE_LENGTH) return `Message must be at most ${MAX_MESSAGE_LENGTH} characters`;
  return null;
}

export function validateInstanceUrl(url: string): string | null {
  if (!url) return 'Instance URL is required';
  try {
    new URL(url);
    return null;
  } catch {
    return 'Invalid URL format';
  }
}
