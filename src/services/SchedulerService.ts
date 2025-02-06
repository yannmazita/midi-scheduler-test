// src/services/SchedulerService.ts
import {
  MidiData,
  MidiEvent,
  MidiNoteOffEvent,
  MidiNoteOnEvent,
} from "midi-file";

export interface SchedulerService {
  loadMidiData(midiData: MidiData): void;
  play(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
}

interface ScheduledNote {
  event: MidiEvent;
  time: number;
  processed: boolean;
}

export class SchedulerServiceImpl implements SchedulerService {
  private audioContext: AudioContext;
  private midiData: MidiData | null = null;
  private oscillators = new Map<number, OscillatorNode>();
  private scheduledNotes: ScheduledNote[] = [];
  private schedulerTimer: number | null = null;
  private currentTime = 0;
  private isPlaying = false;
  private tempoBPM = 120;

  // Scheduler constants
  private readonly LOOKAHEAD = 0.1; // How far ahead to schedule audio (seconds)
  private readonly SCHEDULE_INTERVAL = 25; // How frequently to call scheduling function (milliseconds)
  private readonly SCHEDULE_AHEAD = 0.1; // How far ahead to schedule events (seconds)

  constructor() {
    this.audioContext = new AudioContext();
  }

  loadMidiData(midiData: MidiData): void {
    this.midiData = midiData;
    this.oscillators.clear();
    this.scheduledNotes = [];
    this.currentTime = 0;
    this.prepareEvents();
  }

  private prepareEvents(): void {
    if (!this.midiData?.tracks) return;

    const ticksPerBeat = this.midiData.header.ticksPerBeat ?? 96;
    const secondsPerBeat = 60 / this.tempoBPM;
    const secondsPerTick = secondsPerBeat / ticksPerBeat;

    let currentTime = 0;

    this.midiData.tracks.forEach((track) => {
      track.forEach((event) => {
        currentTime += event.deltaTime * secondsPerTick;
        if (event.type === "noteOn" || event.type === "noteOff") {
          this.scheduledNotes.push({
            event,
            time: currentTime,
            processed: false,
          });
        }
      });
    });

    // Sort events by time
    this.scheduledNotes.sort((a, b) => a.time - b.time);
  }

  async play(): Promise<void> {
    if (!this.midiData || this.isPlaying) return;

    this.isPlaying = true;
    await this.audioContext.resume();
    this.currentTime = 0;
    this.resetEvents();
    this.startScheduler();
  }

  private resetEvents(): void {
    this.scheduledNotes.forEach((note) => (note.processed = false));
  }

  private startScheduler(): void {
    const scheduleNotes = () => {
      const currentTime = this.audioContext.currentTime;
      const lookAheadTime = currentTime + this.SCHEDULE_AHEAD;

      this.scheduledNotes.forEach((note) => {
        if (!note.processed && note.time <= lookAheadTime) {
          if (note.event.type === "noteOn") {
            this.scheduleNoteOn(
              note.event,
              this.audioContext.currentTime + note.time,
            );
          } else if (note.event.type === "noteOff") {
            this.scheduleNoteOff(
              note.event,
              this.audioContext.currentTime + note.time,
            );
          }
          note.processed = true;
        }
      });

      if (this.isPlaying) {
        this.schedulerTimer = window.setTimeout(
          scheduleNotes,
          this.SCHEDULE_INTERVAL,
        );
      }
    };

    scheduleNotes();
  }

  async pause(): Promise<void> {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    await this.audioContext.suspend();
  }

  async resume(): Promise<void> {
    if (!this.isPlaying) {
      this.isPlaying = true;
      await this.audioContext.resume();
      this.startScheduler();
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.oscillators.forEach((oscillator) => {
      oscillator.stop(this.audioContext.currentTime);
      oscillator.disconnect();
    });
    this.oscillators.clear();
    this.currentTime = 0;
    this.resetEvents();
  }

  private scheduleNoteOn(event: MidiNoteOnEvent, playTime: number): void {
    const frequency = this.midiNoteToFrequency(event.noteNumber);
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, playTime);
    gainNode.gain.setValueAtTime(event.velocity / 127, playTime);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(playTime);
    this.oscillators.set(event.noteNumber, oscillator);
  }

  private scheduleNoteOff(event: MidiNoteOffEvent, playTime: number): void {
    const oscillator = this.oscillators.get(event.noteNumber);
    if (oscillator) {
      const gainNode = this.audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Apply a quick fade out
      gainNode.gain.setValueAtTime(gainNode.gain.value, playTime);
      gainNode.gain.linearRampToValueAtTime(0, playTime + 0.03);

      oscillator.stop(playTime + 0.03);
      this.oscillators.delete(event.noteNumber);
    }
  }

  private midiNoteToFrequency(noteNumber: number): number {
    const A4_FREQUENCY = 440;
    const A4_NOTE_NUMBER = 69;
    return A4_FREQUENCY * Math.pow(2, (noteNumber - A4_NOTE_NUMBER) / 12);
  }
}
