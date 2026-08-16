import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { authorizationHeader } from '@/api/client';
import type { BaseItem } from '@/api/types';
import { imageUrl } from '@/api/jellyfin';
import { radii } from '@/constants/theme';
import { colorFromId, colorFromIdLight } from '@/lib/hash-color';
import { useAuth } from '@/store/auth';
import { useColors } from '@/theme/useColors';

type Props = {
  item?: Pick<BaseItem, 'id' | 'imageTags' | 'albumId' | 'albumPrimaryImageTag' | 'parentId' | 'type'> | null;
  size: number;
  rounded?: 'square' | 'circle' | 'album';
  style?: StyleProp<ViewStyle>;
};

export function CoverArt({ item, size, rounded = 'album', style }: Props) {
  const c = useColors();
  const session = useAuth((s) => s.session);
  const radius =
    rounded === 'circle' ? size / 2 : rounded === 'square' ? radii.sm : 6;
  const uri = session && item ? imageUrl(session, item, size * 2, { tokenInQuery: false }) : null;
  const bg = colorFromId(item?.id);
  const bg2 = colorFromIdLight(item?.id);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
          overflow: 'hidden',
        },
        style,
      ]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg2, opacity: 0.55 }]} />
      {uri ? (
        <Image
          source={{
            uri,
            headers: session ? { Authorization: authorizationHeader(session) } : undefined,
          }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          recyclingKey={item?.id}
        />
      ) : null}
      {!uri ? <View style={[StyleSheet.absoluteFill, { borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, borderRadius: radius }]} /> : null}
    </View>
  );
}
