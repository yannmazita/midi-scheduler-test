// src/components/Transport.tsx
import React, { useEffect, useRef } from "react";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { MidiScheduler } from "@/services/MidiScheduler";

export const Transport: React.FC = () => {
  const scheduler = useRef<MidiScheduler | null>(null);
  const schedulerInterval = useRef<number | null>(null);

  const {
    audioContext,
    midiFile,
    isPlaying,
    lookAhead,
    scheduleInterval,
    play,
    pause,
    stop,
  } = useMidiStore();

  useEffect(() => {
    if (audioContext && !scheduler.current) {
      scheduler.current = new MidiScheduler(audioContext);
    }
  }, [audioContext]);

  useEffect(() => {
    if (midiFile && scheduler.current) {
      scheduler.current.loadMidiFile(midiFile);
    }
  }, [midiFile]);

  useEffect(() => {
    if (isPlaying && scheduler.current) {
      scheduler.current.reset();
      schedulerInterval.current = window.setInterval(() => {
        scheduler.current?.schedule(lookAhead);
      }, scheduleInterval);
    } else if (schedulerInterval.current) {
      clearInterval(schedulerInterval.current);
    }

    return () => {
      if (schedulerInterval.current) {
        clearInterval(schedulerInterval.current);
      }
    };
  }, [isPlaying, lookAhead, scheduleInterval]);

  return (
    <div className="transport">
      <button onClick={play} disabled={isPlaying}>
        Play
      </button>
      <button onClick={pause} disabled={!isPlaying}>
        Pause
      </button>
      <button onClick={stop}>Stop</button>
    </div>
  );
};
