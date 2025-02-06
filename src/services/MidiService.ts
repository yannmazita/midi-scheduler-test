// src/services/MidService.ts
import { useAppStore } from "@/core/stores/appStore";
import { parseMidi, MidiData, MidiEvent, MidiHeader } from "midi-file";

export interface MidiService {
  loadMidiFile(file: File): Promise<void>;
  getMidiData(): MidiData | null;
  getMidiHeader(): MidiHeader | null;
  getMidiTracks(): MidiEvent[][] | null;
}

export class MidiServiceImpl implements MidiService {
  private midiData: MidiData | null = null;

  async loadMidiFile(file: File): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      this.midiData = parseMidi(uint8Array);
      this.updateStore();
    } catch (error) {
      console.error("Error loading or parsing MIDI file:", error);
      this.midiData = null;
      this.updateStore();
      throw error;
    }
  }

  getMidiData(): MidiData | null {
    return this.midiData;
  }

  getMidiHeader(): MidiHeader | null {
    return this.midiData ? this.midiData.header : null;
  }

  getMidiTracks(): MidiEvent[][] | null {
    return this.midiData ? this.midiData.tracks : null;
  }

  private updateStore(): void {
    const { setMidiData, setMidiHeader, setMidiTracks, setMidiFileName } =
      useAppStore.getState(); // Use named hook
    setMidiData(this.midiData);
    setMidiHeader(this.getMidiHeader());
    setMidiTracks(this.getMidiTracks());
    if (this.midiData?.tracks) {
      // Data loaded successfully, filename already set in store
    } else {
      setMidiFileName(null);
    }
  }
}
