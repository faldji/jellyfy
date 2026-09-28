/**
 * expo-audio 57.0.5 lock screen is play/pause and optional ±10s.
 * The patch adds next, previous, shuffle, and repeat so the engine owns the queue.
 * Rebuild the dev client after this runs. Expo Go does not compile it.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const markerFile = 'node_modules/expo-audio/ios/MediaController.swift';
const pkgFile = 'node_modules/expo-audio/package.json';
const patchFile = 'patches/expo-audio+57.0.5.patch';

if (!existsSync(pkgFile) || !existsSync(markerFile)) {
  process.exit(0);
}

const version = JSON.parse(readFileSync(pkgFile, 'utf8')).version;
if (version !== '57.0.5') {
  console.warn(
    `expo-audio ${version} does not match patches/expo-audio+57.0.5.patch. Lock-screen next and previous stay unavailable until the patch is updated.`
  );
  process.exit(0);
}

const source = readFileSync(markerFile, 'utf8');
if (source.includes('onRemoteShuffle')) {
  process.exit(0);
}

const result = spawnSync('patch', ['-p1', '--forward', '--batch', '--input', patchFile], {
  stdio: 'inherit',
});
if (result.status !== 0) {
  console.error('Failed to apply the expo-audio lock-screen patch.');
  process.exit(result.status ?? 1);
}
