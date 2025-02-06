// src/store/appStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { MidiData, MidiHeader, MidiEvent } from "midi-file";
import { MidiServiceImpl } from "@/services/MidiService";
import { SchedulerServiceImpl } from "@/services/SchedulerService";

interface AppStore {
  midiData: MidiData | null;
  midiHeader: MidiHeader | null;
  midiTracks: MidiEvent[][] | null;
  midiFileName: string | null;
  isPlaying: boolean;
  isPaused: boolean;

  setMidiData: (data: MidiData | null) => void;
  setMidiHeader: (header: MidiHeader | null) => void;
  setMidiTracks: (tracks: MidiEvent[][] | null) => void;
  setMidiFileName: (name: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;

  loadMidiFile: (file: File) => Promise<void>; // Action to trigger MIDI loading via MidiService
  playMidi: () => void; // Action to trigger playback via SchedulerService
  togglePlayPauseMidi: () => void;
  stopMidi: () => void; // Action to trigger stop via SchedulerService
}

export const useAppStore = create<AppStore>()(
  devtools((set, get) => {
    const midiService: MidiServiceImpl = new MidiServiceImpl();
    const schedulerService: SchedulerServiceImpl = new SchedulerServiceImpl();

    return {
      midiData: null,
      midiHeader: null,
      midiTracks: null,
      midiFileName: null,
      isPlaying: false,
      isPaused: false,

      setMidiData: (data) => set({ midiData: data }),
      setMidiHeader: (header) => set({ midiHeader: header }),
      setMidiTracks: (tracks) => set({ midiTracks: tracks }),
      setMidiFileName: (name) => set({ midiFileName: name }),
      setIsPlaying: (isPlaying) => set({ isPlaying: isPlaying }),
      setIsPaused: (isPaused) => set({ isPaused: isPaused }),

      loadMidiFile: async (file: File) => {
        set({ midiFileName: file.name });
        try {
          await midiService.loadMidiFile(file);
          const midiData = get().midiData; // Get loaded midi data from store
          if (midiData) {
            schedulerService.loadMidiData(midiData); // Load midi data into scheduler service
          }
        } catch (error) {
          console.error("Error in loadMidiFile action:", error);
        }
      },
      playMidi: () => {
        schedulerService.play(); // Call play method of SchedulerService
        set({ isPlaying: true, isPaused: false });
        console.log("Playing MIDI");
      },
      togglePlayPauseMidi: () => {
        const { isPlaying, isPaused } = get();
        if (isPlaying) {
          schedulerService.pause(); // Call pause method of SchedulerService
          set({ isPlaying: false, isPaused: true });
          console.log("Pausing MIDI");
        } else if (isPaused) {
          schedulerService.resume(); // Call resume method of SchedulerService
          set({ isPlaying: true, isPaused: false });
          console.log("Resuming MIDI");
        } else {
          schedulerService.play(); // Call play method of SchedulerService
          set({ isPlaying: true, isPaused: false });
          console.log("Playing MIDI");
        }
      },
      stopMidi: () => {
        schedulerService.stop(); // Call stop method of SchedulerService
        set({ isPlaying: false, isPaused: false });
        console.log("Stopping MIDI");
      },
    };
  }),
);
