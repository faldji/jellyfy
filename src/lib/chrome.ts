import type { Href } from 'expo-router';

export const CHROME_HIDDEN = ['/player', '/queue', '/add-to-playlist', '/create-playlist'] as const;

export function hideAppChrome(pathname: string): boolean {
  return CHROME_HIDDEN.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export type AppTabKey = 'index' | 'search' | 'library' | 'queue';

export const APP_TABS: {
  key: AppTabKey;
  href: Href;
  label: string;
  on: 'home' | 'search' | 'library' | 'list';
  off: 'home-outline' | 'search-outline' | 'library-outline' | 'list-outline';
}[] = [
  { key: 'index', href: '/', label: 'Home', on: 'home', off: 'home-outline' },
  { key: 'search', href: '/search', label: 'Search', on: 'search', off: 'search-outline' },
  { key: 'library', href: '/library', label: 'Your Library', on: 'library', off: 'library-outline' },
  { key: 'queue', href: '/queue', label: 'Queue', on: 'list', off: 'list-outline' },
];

export function tabFromPathname(pathname: string): AppTabKey | null {
  if (pathname === '/' || pathname === '') return 'index';
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/library')) return 'library';
  return null;
}
