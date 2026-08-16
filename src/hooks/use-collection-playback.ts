import type { BaseItem } from '@/api/types';
import { usePlayer } from '@/store/player';

export function useCollectionPlayback(contextId?: string, items: BaseItem[] = [], seed?: BaseItem | null) {
  const playCollection = usePlayer((s) => s.playCollection);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playing = usePlayer((s) => s.playing);
  const preparing = usePlayer((s) => s.preparing);
  const activeId = usePlayer((s) => s.contextId);
  const active = Boolean(contextId && activeId === contextId);

  return {
    playing: active && playing,
    busy: active && preparing,
    play() {
      if (active) {
        void togglePlay();
        return;
      }
      void playCollection(items, {
        contextId,
        seed: seed ?? undefined,
        continueWithSr: Boolean(contextId?.startsWith('radio:') || contextId?.startsWith('mix:')),
      });
    },
    shuffle() {
      void playCollection(items, {
        contextId,
        seed: seed ?? undefined,
        shuffle: true,
        continueWithSr: Boolean(contextId?.startsWith('radio:') || contextId?.startsWith('mix:')),
      });
    },
  };
}
