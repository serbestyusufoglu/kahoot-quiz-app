import { useEffect, useState } from 'react';
import type { GameStatus } from '../../shared/types.ts';
import { soundManager } from './sound.ts';

export function useServerTimer(params: {
  status: GameStatus | undefined;
  questionEndsAt: number | null | undefined;
  remainingMsWhenPaused: number | null | undefined;
  serverTime: number | undefined;
  playTickSound?: boolean;
}) {
  const { status, questionEndsAt, remainingMsWhenPaused, serverTime, playTickSound = false } = params;
  const [clockOffset, setClockOffset] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (serverTime) {
      setClockOffset(serverTime - Date.now());
    }
  }, [serverTime]);

  useEffect(() => {
    if (status === 'PAUSED') {
      const pausedSec = remainingMsWhenPaused
        ? Math.max(0, Math.ceil(remainingMsWhenPaused / 1000))
        : 0;
      setRemainingSeconds(pausedSec);
      return;
    }

    if (status !== 'QUESTION' || !questionEndsAt) {
      setRemainingSeconds(0);
      return;
    }

    let lastSec = -1;

    const update = () => {
      const syncedNow = Date.now() + clockOffset;
      const diffMs = Math.max(0, questionEndsAt - syncedNow);
      const sec = Math.ceil(diffMs / 1000);
      setRemainingSeconds(sec);

      if (playTickSound && sec !== lastSec && sec > 0 && sec <= 5) {
        soundManager.playTick();
      }
      lastSec = sec;
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [status, questionEndsAt, remainingMsWhenPaused, clockOffset, playTickSound]);

  return remainingSeconds;
}
