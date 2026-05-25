/**
 * Preloads game sound effects via expo-audio and exposes a play(key) call.
 *
 * Failure-tolerant: if the expo-audio native module is missing (dev client
 * built without it, or pre-rebuild), every play() call silently no-ops
 * instead of crashing. The game still runs; sounds just won't fire.
 *
 * Asset files live in /assets/sounds/. The current files are programmatically-
 * generated placeholders — replace them with real game audio without
 * touching this hook.
 */
import { useEffect, useRef } from 'react';

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

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
  const playersRef = useRef<Partial<Record<SoundKey, AudioPlayer>>>({});

  useEffect(() => {
    const players: Partial<Record<SoundKey, AudioPlayer>> = {};
    for (const key of Object.keys(SOURCES) as SoundKey[]) {
      try {
        players[key] = createAudioPlayer(SOURCES[key]);
      } catch {
        // expo-audio native module missing or this source failed —
        // skip; play() will no-op for this key.
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
