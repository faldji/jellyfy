import { Redirect } from 'expo-router';

/** Liked Songs is not a tab. Keep /likes as a deep link. */
export default function LikesRedirect() {
  return <Redirect href="/(app)/(tabs)/likes" />;
}
