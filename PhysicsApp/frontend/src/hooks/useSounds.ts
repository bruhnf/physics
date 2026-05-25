/**
 * Preloads game sound effects via expo-audio and exposes a play(key) call.
 *
 * Failure-tolerant on two axes:
 *   1. expo-audio crashes at IMPORT time when its native module isn't in the
 *      dev client. Lazy-require + try/catch around the import keeps the app
 *      bootable on older builds (sounds simply won't play until the rebuild).
 *   2. Even when imported, createAudioPlayer can fail per-source. We catch
 *      individually so one bad asset doesn't take down the whole sound bank.
 *
 * Asset files live in /assets/sounds/. The current files are programmatically-
 * generated placeholders — replace them with real game audio without
 * touching this hook.
 */
import { useEffect, useRef } from 'react';

let createAudioPlayer:
  | ((source: ReturnType<typeof require>) => AudioPlayerHandle)
  | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  createAudioPlayer = require('expo-audio').createAudioPlayer;
} catch {
  // expo-audio native module missing — sound system inert.
}

type AudioPlayerHandle = {
  play: () => void;
  seekTo: (seconds: number) => void;
  remove?: () => void;
};

const SOURCES = {
  launch: require('@/assets/sounds/launch.wav'),
  hit: require('@/assets/sounds/hit.wav'),
  close: require('@/assets/sounds/close.wav'),
  miss: require('@/assets/sounds/miss.wav'),
  wallHit: require('@/assets/sounds/wall-hit.wav'),
  levelComplete: require('@/assets/sounds/level-complete.wav'),
} as const;

export type SoundKey = keyof typeof SOURCES;

export function useSounds() {
  const playersRef = useRef<Partial<Record<SoundKey, AudioPlayerHandle>>>({});

  useEffect(() => {
    if (!createAudioPlayer) return;
    const players: Partial<Record<SoundKey, AudioPlayerHandle>> = {};
    for (const key of Object.keys(SOURCES) as SoundKey[]) {
      try {
        players[key] = createAudioPlayer(SOURCES[key]);
      } catch {
        // Skip this source; play() will no-op for this key.
      }
    }
    playersRef.current = players;

    return () => {
      for (const player of Object.values(playersRef.current)) {
        try {
          player?.remove?.();
        } catch {
          // ignore
        }
      }
      playersRef.current = {};
    };
  }, []);

  function play(key: SoundKey) {
    const player = playersRef.current?.[key];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore
    }
  }

  return play;
}
