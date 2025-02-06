// src/services/SchedulerService.ts
import { MidiData, MidiNoteOffEvent, MidiNoteOnEvent } from "midi-file";

export interface SchedulerService {
  loadMidiData(midiData: MidiData): void;
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export class SchedulerServiceImpl implements SchedulerService {
  private audioContext: BaseAudioContext;
  private midiData: MidiData | null = null;
  private oscillators = new Map<number, OscillatorNode>(); // Track active oscillators

  constructor() {
    this.audioContext = new AudioContext();
  }

  loadMidiData(midiData: MidiData): void {
    this.midiData = midiData;
    this.oscillators.clear(); // Clear oscillators when loading new MIDI data
  }

  play(): void {
    if (!this.midiData) {
      console.warn("No MIDI data loaded.");
      return;
    }

    const tracks = this.midiData.tracks;
    if (!tracks) {
      console.warn("No tracks found in MIDI data.");
      return;
    }

    const header = this.midiData.header;
    const ticksPerBeat = header.ticksPerBeat ?? 96; // Default ticks per beat if not specified
    const tempoBPM = 120; // Fixed tempo for now (120 BPM)
    const secondsPerBeat = 60 / tempoBPM;
    const secondsPerTick = secondsPerBeat / ticksPerBeat;

    let currentPlayTime = this.audioContext.currentTime; // Initialize currentPlayTime once

    tracks.forEach((track) => {
      track.forEach((event) => {
        currentPlayTime += event.deltaTime * secondsPerTick; // Accumulate deltaTime for all events

        if (event.type === "noteOn") {
          const noteOnEvent = event;
          this.scheduleNoteOn(noteOnEvent, currentPlayTime);
        } else if (event.type === "noteOff") {
          const noteOffEvent = event;
          this.scheduleNoteOff(noteOffEvent, currentPlayTime);
        }
      });
    });
  }

  pause(): void {
    // Implementation for pause will be added later
    console.log("Pause not yet implemented");
  }

  resume(): void {
    // Implementation for resume will be added later
    console.log("Resume not yet implemented");
  }

  stop(): void {
    // Stop all oscillators
    this.oscillators.forEach((oscillator) => {
      oscillator.stop(this.audioContext.currentTime);
      oscillator.disconnect();
    });
    this.oscillators.clear();
    console.log("Stopping MIDI");
  }

  private scheduleNoteOn(event: MidiNoteOnEvent, playTime: number): void {
    const frequency = this.midiNoteToFrequency(event.noteNumber);
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = "sine"; // Basic sine wave for now
    oscillator.frequency.setValueAtTime(
      frequency,
      this.audioContext.currentTime,
    );
    gainNode.gain.setValueAtTime(
      event.velocity / 127,
      this.audioContext.currentTime,
    ); // Velocity control
    gainNode.gain.setValueAtTime(0, playTime + 0.5); // simple fade out

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(playTime);
    oscillator.stop(playTime + 0.5); // Placeholder: fixed note duration of 0.5 seconds. Needs proper noteOff event handling.

    this.oscillators.set(event.noteNumber, oscillator); // Track oscillator for stop function
  }

  private scheduleNoteOff(event: MidiNoteOffEvent, playTime: number): void {
    // Note off scheduling will be implemented later
    console.log(`Note Off event for note ${event.noteNumber} at ${playTime}`);
    const oscillator = this.oscillators.get(event.noteNumber);
    if (oscillator) {
      oscillator.stop(playTime);
      this.oscillators.delete(event.noteNumber);
    }
  }

  private midiNoteToFrequency(noteNumber: number): number {
    const A4_FREQUENCY = 440;
    const A4_NOTE_NUMBER = 69; // MIDI note number for A4

    const exponent = (noteNumber - A4_NOTE_NUMBER) / 12;
    const frequency = A4_FREQUENCY * Math.pow(2, exponent);
    return frequency;
  }
}
