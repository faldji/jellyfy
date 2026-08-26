const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function replaceIfPresent(file, from, to) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`playback patch target not found: ${file}`);
  }
  fs.writeFileSync(file, source.replace(from, to));
}

module.exports = function withExpoAudioMediaControls(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const root = config.modRequest.projectRoot;

    // App-level fixes are applied at prebuild so they stay source-controlled and
    // do not require patch-package. The operation is idempotent.
    const engine = path.join(root, 'src', 'playback', 'engine.ts');
    replaceIfPresent(
      engine,
      `    if (this.wantPlaying && status.playing && this.reportedStartFor !== this.currentItem()?.id) {\n      void this.report('start');\n    }`,
      `    if (this.wantPlaying && status.playing) {\n      const startItemId = this.currentItem()?.id ?? null;\n      if (startItemId && this.reportedStartFor !== startItemId) {\n        this.reportedStartFor = startItemId;\n        void this.report('start');\n      }\n    }`
    );
    replaceIfPresent(
      engine,
      `      } catch {\n        // Reporting is best-effort; streaming still works without it.\n      }`,
      `      } catch {\n        if (kind === 'start' && this.playSessionId === playSessionId && this.reportedStartFor === item.id) {\n          this.reportedStartFor = null;\n        }\n        // Reporting is best-effort; streaming still works without it.\n      }`
    );
    replaceIfPresent(
      engine,
      `  private unsub: { remove: () => void } | null = null;`,
      `  private unsub: { remove: () => void } | null = null;\n  private nativeControlUnsubs: { remove: () => void }[] = [];`
    );
    replaceIfPresent(
      engine,
      `    this.unsub?.remove();\n    this.unsub = null;`,
      `    this.unsub?.remove();\n    this.unsub = null;\n    this.nativeControlUnsubs.forEach((subscription) => subscription.remove());\n    this.nativeControlUnsubs = [];`
    );
    replaceIfPresent(
      engine,
      `      player.setActiveForLockScreen(true, {\n        title: item.name,\n        artist: artistLine(item),\n        albumTitle: item.album,\n        artworkUrl,\n      });`,
      `      player.setActiveForLockScreen(true, {\n        title: item.name,\n        artist: artistLine(item),\n        albumTitle: item.album,\n        artworkUrl,\n      }, {\n        showSeekForward: true,\n        showSeekBackward: true,\n        ...(Platform.OS === 'android' ? { showNextTrack: true, showPreviousTrack: true } : {}),\n      } as any);\n\n      this.nativeControlUnsubs.forEach((subscription) => subscription.remove());\n      this.nativeControlUnsubs = [];\n      if (Platform.OS === 'android') {\n        const remotePlayer = player as AudioPlayer & {\n          addListener: (event: string, listener: () => void) => { remove: () => void };\n        };\n        this.nativeControlUnsubs.push(\n          remotePlayer.addListener('onRemoteNextTrack', () => { void this.userNext(); }),\n          remotePlayer.addListener('onRemotePreviousTrack', () => { void this.previous(); })\n        );\n      }`
    );

    const advance = path.join(root, 'src', 'playback', 'advance.ts');
    replaceIfPresent(
      advance,
      `export type NativePlaybackSignal = {\n  didJustFinish?: boolean;\n  playbackState?: string;\n};`,
      `export type NativePlaybackSignal = {\n  didJustFinish?: boolean;\n  playbackState?: string;\n  isLoaded?: boolean;\n  playing?: boolean;\n  currentTime?: number;\n  duration?: number;\n};`
    );
    replaceIfPresent(
      advance,
      `  return Boolean(status.didJustFinish) || status.playbackState === 'ended';`,
      `  if (status.didJustFinish || status.playbackState === 'ended') return true;\n  const duration = Number(status.duration ?? 0);\n  const position = Number(status.currentTime ?? 0);\n  return Boolean(\n    status.isLoaded &&\n      !status.playing &&\n      Number.isFinite(duration) &&\n      duration > 1 &&\n      Number.isFinite(position) &&\n      position >= duration - 0.35\n  );`
    );

    // Patch expo-audio's Android MediaSession. SDK 57 exposes only seek-forward
    // and seek-backward in AudioLockScreenOptions; previous/next are not yet
    // available in the stock module.
    const pkg = path.join(root, 'node_modules', 'expo-audio');
    const java = path.join(pkg, 'android', 'src', 'main', 'java', 'expo', 'modules', 'audio');
    const records = path.join(java, 'AudioRecords.kt');
    const service = path.join(java, 'service', 'AudioControlsService.kt');
    const callback = path.join(java, 'service', 'AudioMediaSessionCallback.kt');

    replaceIfPresent(
      records,
      '  @Field val showSeekBackward: Boolean\n) : Record',
      '  @Field val showSeekBackward: Boolean,\n  @Field val showNextTrack: Boolean = false,\n  @Field val showPreviousTrack: Boolean = false\n) : Record'
    );

    replaceIfPresent(
      service,
      '        ACTION_SEEK_FORWARD -> currentPlayerRef.seekTo(currentPlayerRef.currentPosition + SEEK_INTERVAL_MS)',
      '        ACTION_NEXT_TRACK -> currentPlayer?.emit("onRemoteNextTrack", emptyMap<String, Any>())\n        ACTION_PREVIOUS_TRACK -> currentPlayer?.emit("onRemotePreviousTrack", emptyMap<String, Any>())\n        ACTION_SEEK_FORWARD -> currentPlayerRef.seekTo(currentPlayerRef.currentPosition + SEEK_INTERVAL_MS)'
    );
    replaceIfPresent(
      service,
      '    if (currentOptions?.showSeekBackward == true) {',
      '    if (currentOptions?.showPreviousTrack == true) {\n      customLayout.add(\n        CommandButton.Builder(CommandButton.ICON_PREVIOUS)\n          .setDisplayName("Previous")\n          .setEnabled(true)\n          .setSessionCommand(SessionCommand(ACTION_PREVIOUS_TRACK, Bundle.EMPTY))\n          .build()\n      )\n    }\n\n    if (currentOptions?.showSeekBackward == true) {'
    );
    replaceIfPresent(
      service,
      '    session.setCustomLayout(customLayout)',
      '    if (currentOptions?.showNextTrack == true) {\n      customLayout.add(\n        CommandButton.Builder(CommandButton.ICON_NEXT)\n          .setDisplayName("Next")\n          .setEnabled(true)\n          .setSessionCommand(SessionCommand(ACTION_NEXT_TRACK, Bundle.EMPTY))\n          .build()\n      )\n    }\n\n    session.setCustomLayout(customLayout)'
    );
    replaceIfPresent(
      service,
      '            .setCallback(AudioMediaSessionCallback())',
      '            .setCallback(AudioMediaSessionCallback { action ->\n              when (action) {\n                ACTION_NEXT_TRACK -> currentPlayer?.emit("onRemoteNextTrack", emptyMap<String, Any?>())\n                ACTION_PREVIOUS_TRACK -> currentPlayer?.emit("onRemotePreviousTrack", emptyMap<String, Any?>())\n              }\n            })'
    );
    replaceIfPresent(
      service,
      '    const val ACTION_SEEK_BACKWARD = "expo.modules.audio.action.SEEK_BACKWARD"',
      '    const val ACTION_SEEK_BACKWARD = "expo.modules.audio.action.SEEK_BACKWARD"\n    const val ACTION_NEXT_TRACK = "expo.modules.audio.action.NEXT_TRACK"\n    const val ACTION_PREVIOUS_TRACK = "expo.modules.audio.action.PREVIOUS_TRACK"'
    );

    replaceIfPresent(
      callback,
      'class AudioMediaSessionCallback : MediaSession.Callback {',
      'class AudioMediaSessionCallback(\n  private val onCustomAction: ((String) -> Unit)? = null\n) : MediaSession.Callback {'
    );
    replaceIfPresent(
      callback,
      '                .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))',
      '                .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))\n                .add(SessionCommand(AudioControlsService.ACTION_NEXT_TRACK, Bundle.EMPTY))\n                .add(SessionCommand(AudioControlsService.ACTION_PREVIOUS_TRACK, Bundle.EMPTY))'
    );
    replaceIfPresent(
      callback,
      '          AudioControlsService.ACTION_SEEK_BACKWARD -> {\n            session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)\n          }',
      '          AudioControlsService.ACTION_SEEK_BACKWARD -> {\n            session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)\n          }\n          AudioControlsService.ACTION_NEXT_TRACK, AudioControlsService.ACTION_PREVIOUS_TRACK -> {\n            onCustomAction?.invoke(command.customAction)\n          }'
    );

    return config;
  }]);
};
