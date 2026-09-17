import type { PlatformKey } from "../types";

export interface PlatformOAuthConfig {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  description: string;
  tokenLifetimeDays: number; // 0 = no expiry / long-lived
  requiresLinkedAccount: boolean;
  linkedAccountNote?: string;
}

export const OAUTH_CONFIGS: Record<PlatformKey, PlatformOAuthConfig> = {
  facebook: {
    name: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["pages_read_engagement", "pages_show_list", "read_insights"],
    description: "Facebook Login for Business — pages, insights, engagement data.",
    tokenLifetimeDays: 60,
    requiresLinkedAccount: false,
  },
  instagram: {
    name: "Instagram",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_manage_insights"],
    description: "Instagram Graph API — requires a linked Facebook Business Page.",
    tokenLifetimeDays: 60,
    requiresLinkedAccount: true,
    linkedAccountNote: "The Instagram account must be a Business or Creator account linked to a Facebook Page.",
  },
  youtube: {
    name: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    description: "Google OAuth — YouTube Data API for channel stats.",
    tokenLifetimeDays: 0, // refresh tokens are long-lived
    requiresLinkedAccount: false,
  },
  tiktok: {
    name: "TikTok",
    authUrl: "https://business-api.tiktok.com/portal/auth",
    tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    scopes: ["user.info.basic", "video.list"],
    description: "TikTok for Business Login — follower/video analytics.",
    tokenLifetimeDays: 90,
    requiresLinkedAccount: false,
  },
};

// Simulate OAuth — returns fake tokens
export function simulateOAuth(platform: PlatformKey): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const config = OAUTH_CONFIGS[platform];
  const lifetime = config.tokenLifetimeDays > 0
    ? config.tokenLifetimeDays * 86400
    : 365 * 86400;

  return {
    accessToken: `mock_${platform}_at_${Date.now().toString(36)}`,
    refreshToken: `mock_${platform}_rt_${Date.now().toString(36)}`,
    expiresIn: lifetime,
  };
}

// Check if token is expired
export function isTokenExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// Format token expiry warning
export function tokenExpiryWarning(expiresAt: string): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return "Token expired";
  if (daysLeft <= 7) return `Token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  return null;
}
