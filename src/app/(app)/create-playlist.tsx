import { useRouter } from 'expo-router';

import { CreatePlaylistForm } from '@/components/CreatePlaylistHost';
import { closeOverlay } from '@/lib/navigation';

export default function CreatePlaylistScreen() {
  const router = useRouter();
  return <CreatePlaylistForm interceptBack onClose={() => closeOverlay(router)} />;
}
