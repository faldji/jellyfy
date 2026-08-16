import type { Href } from 'expo-router';

import type { BaseItem } from '@/api/types';
import { APP_TABS } from '@/lib/chrome';
import { useUi } from '@/store/ui';

type OverlayRouter = {
  canDismiss: () => boolean;
  dismiss: (count?: number) => void;
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

export function hrefForItem(item: Pick<BaseItem, 'id' | 'type' | 'name'>): Href {
  switch (item.type) {
    case 'MusicAlbum':
      return { pathname: '/album/[id]', params: { id: item.id } };
    case 'MusicArtist':
      return { pathname: '/artist/[id]', params: { id: item.id } };
    case 'Playlist':
      return { pathname: '/playlist/[id]', params: { id: item.id } };
    case 'MusicGenre':
    case 'Genre':
      return { pathname: '/genre/[name]', params: { name: item.id, title: item.name } };
    default:
      return { pathname: '/album/[id]', params: { id: item.id } };
  }
}

/** Close a modal (now playing, queue) without dispatching GO_BACK on an empty stack. */
export function closeOverlay(router: OverlayRouter) {
  try {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
  } catch {
    // canDismiss can throw from a root layout.
  }
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // No history entry (reload on /player, cold deep link).
  }
  const tab = APP_TABS.find((entry) => entry.key === useUi.getState().lastTab) ?? APP_TABS[0];
  router.replace(tab.href);
}
