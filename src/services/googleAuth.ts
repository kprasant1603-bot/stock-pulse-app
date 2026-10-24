/**
 * Google Auth & Gmail API Integration via Firebase Auth & OAuth 2.0
 * Adheres strictly to workspace-integration skill guidelines:
 * - Scopes: https://www.googleapis.com/auth/gmail.send
 * - In-memory access token caching (never stored in localStorage)
 * - Clean sign-in / sign-out handlers
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if sign-in popup is in progress
let isSigningIn = false;

// In-memory access token cache (MANDATORY: NEVER stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Access token needs refresh via interactive sign-in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return cachedUser;
};

export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
};

/**
 * Format RFC 2822 multipart email and encode into base64url for Gmail API
 */
export function buildRawEmail(
  to: string,
  from: string,
  subject: string,
  bodyText: string,
  bodyHtml: string
): string {
  const boundary = `__boundary_stockpulse_${Date.now()}`;
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  const emailLines = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${utf8Subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyHtml,
    ``,
    `--${boundary}--`,
  ];

  const rawString = emailLines.join('\r\n');

  // Convert to base64url format required by Gmail API
  return btoa(unescape(encodeURIComponent(rawString)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send an email directly via the official Gmail REST API using the user's active Google OAuth token
 */
export async function sendGmailMessage(
  to: string,
  from: string,
  subject: string,
  bodyText: string,
  bodyHtml: string
): Promise<{ success: boolean; messageId: string; threadId?: string; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No active Gmail access token. Please connect your Gmail account.');
  }

  const rawBase64 = buildRawEmail(to, from, subject, bodyText, bodyHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: rawBase64,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Gmail API returned error status ${response.status}`);
  }

  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId,
  };
}
