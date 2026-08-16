import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { APP_DEVICE } from '@/constants/app';

const MAX_DEVICE_NAME = 64;

/** Strip characters that would break the MediaBrowser Authorization header. */
export function sanitizeDeviceName(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .replace(/["\\\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DEVICE_NAME);
  return cleaned || APP_DEVICE;
}

function browserLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Web';
}

function osLabel(): string {
  if (typeof navigator === 'undefined') return '';
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform || navigator.platform || '';
  const ua = navigator.userAgent;
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(platform) || /Mac OS/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'Linux';
  return platform.trim();
}

function webDeviceName(): string {
  const browser = browserLabel();
  const os = osLabel();
  return os ? `${browser} on ${os}` : browser;
}

/** Human device name for Jellyfin `Device=` — phone name, model, or browser + OS. */
export function resolveDeviceName(): string {
  const native = Device.deviceName?.trim() || Device.modelName?.trim();
  if (native) return sanitizeDeviceName(native);
  if (Platform.OS === 'web') return sanitizeDeviceName(webDeviceName());
  return sanitizeDeviceName(APP_DEVICE);
}
