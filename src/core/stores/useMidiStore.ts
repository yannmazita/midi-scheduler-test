// src/core/stores/useMidiStore.ts
import { create } from "zustand";
import { MidiFile } from "midifile-ts";

interface MidiState {
  audioContext: AudioContext | null;
  midiFile: MidiFile | null;
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  lookAhead: number;
  scheduleInterval: number;
  fileName: string | null;

  // Actions
  setMidiFile: (file: MidiFile) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentTime: (time: number) => void;
  setTempo: (tempo: number) => void;
}

export const useMidiStore = create<MidiState>((set, get) => ({
  audioContext: null,
  midiFile: null,
  isPlaying: false,
  currentTime: 0,
  tempo: 120,
  lookAhead: 0.1, // seconds
  scheduleInterval: 25, // milliseconds
  fileName: null,

  setMidiFile: (file, fileName = null) =>
    set({
      midiFile: file,
      fileName,
      currentTime: 0,
      isPlaying: false,
    }),

  play: () => {
    const state = get();
    if (!state.audioContext) {
      const ctx = new AudioContext();
      set({ audioContext: ctx });
    }
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  stop: () => {
    set({ isPlaying: false, currentTime: 0 });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setTempo: (tempo) => set({ tempo }),
}));
