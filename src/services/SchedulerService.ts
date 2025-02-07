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

interface Position {
  measure: number;
  beat: number;
  ticksInBeat: number;
}

interface ScheduledNote {
  event: MidiEvent;
  time: number;
  processed: boolean;
  position: Position;
}

interface TempoChange {
  tick: number;
  tempo: number; // microseconds per quarter note
  timeSeconds: number;
}

interface TimeSignatureChange {
  tick: number;
  numerator: number;
  denominator: number;
  metronome: number;
  thirtySeconds: number;
  timeSeconds: number;
}

export class SchedulerServiceImpl implements SchedulerService {
  private audioContext: AudioContext;
  private midiData: MidiData | null = null;
  private oscillators = new Map<number, OscillatorNode>();
  private scheduledNotes: ScheduledNote[] = [];
  private schedulerTimer: number | null = null;
  private startTime: number | null = null;
  private currentTime = 0;
  private position: Position | null = null;
  private isPlaying = false;
  private activeGainNodes = new Map<number, GainNode>();

  // Tempo tracking
  private tempoChanges: TempoChange[] = [];
  private defaultTempo = 500000; // 120 BPM in microseconds per quarter note

  // Time signature tracking
  private timeSignatures: TimeSignatureChange[] = [];
  private defaultTimeSignature: TimeSignatureChange = {
    tick: 0,
    numerator: 4,
    denominator: 4,
    metronome: 24,
    thirtySeconds: 8,
    timeSeconds: 0,
  };

  // Scheduler constants
  private readonly LOOKAHEAD = 0.1;
  private readonly SCHEDULE_INTERVAL = 25;
  private readonly SCHEDULE_AHEAD = 0.1;

  constructor() {
    this.audioContext = new AudioContext();
  }

  loadMidiData(midiData: MidiData): void {
    this.midiData = midiData;
    this.oscillators.clear();
    this.scheduledNotes = [];
    this.tempoChanges = [];
    this.timeSignatures = [];
    this.analyzeTempoAndTimeSignature();
    this.prepareEvents();
  }

  private analyzeTempoAndTimeSignature(): void {
    if (!this.midiData?.tracks) return;

    let currentTick = 0;
    let currentTimeSeconds = 0;

    // Initialize with defaults
    this.tempoChanges.push({
      tick: 0,
      tempo: this.defaultTempo,
      timeSeconds: 0,
    });

    this.timeSignatures.push({
      ...this.defaultTimeSignature,
    });

    // Analyze all tracks for tempo and time signature changes
    this.midiData.tracks.forEach((track) => {
      currentTick = 0;

      track.forEach((event) => {
        currentTick += event.deltaTime;

        if (event.type === "setTempo") {
          const tempoEvent = event;
          currentTimeSeconds = this.ticksToSeconds(currentTick);

          this.tempoChanges.push({
            tick: currentTick,
            tempo: tempoEvent.microsecondsPerBeat,
            timeSeconds: currentTimeSeconds,
          });
        } else if (event.type === "timeSignature") {
          const tsEvent = event;
          currentTimeSeconds = this.ticksToSeconds(currentTick);

          this.timeSignatures.push({
            tick: currentTick,
            numerator: tsEvent.numerator,
            denominator: Math.pow(2, tsEvent.denominator),
            metronome: tsEvent.metronome,
            thirtySeconds: tsEvent.thirtyseconds,
            timeSeconds: currentTimeSeconds,
          });
        }
      });
    });

    // Sort changes by tick
    this.tempoChanges.sort((a, b) => a.tick - b.tick);
    this.timeSignatures.sort((a, b) => a.tick - b.tick);
  }

  // Get current time signature at a given tick
  private getTimeSignatureAtTick(tick: number): TimeSignatureChange {
    let timeSignature = this.defaultTimeSignature;

    for (let i = this.timeSignatures.length - 1; i >= 0; i--) {
      if (tick >= this.timeSignatures[i].tick) {
        timeSignature = this.timeSignatures[i];
        break;
      }
    }

    return timeSignature;
  }

  // Calculate measure number and beat position
  private getPositionAtTick(tick: number): {
    measure: number;
    beat: number;
    ticksInBeat: number;
  } {
    if (!this.midiData?.header.ticksPerBeat) {
      return { measure: 0, beat: 0, ticksInBeat: 0 };
    }

    let currentTick = 0;
    let measure = 0;
    let currentTimeSignature = this.defaultTimeSignature;
    const ticksPerBeat = this.midiData.header.ticksPerBeat;

    // Find the correct time signature and calculate measures
    for (const ts of this.timeSignatures) {
      if (tick < ts.tick) {
        break;
      }

      // Calculate full measures in the previous time signature
      const ticksInThisSection = ts.tick - currentTick;
      const ticksPerMeasure = ticksPerBeat * currentTimeSignature.numerator;
      measure += Math.floor(ticksInThisSection / ticksPerMeasure);

      currentTick = ts.tick;
      currentTimeSignature = ts;
    }

    // Calculate remaining ticks
    const remainingTicks = tick - currentTick;
    const ticksPerMeasure = ticksPerBeat * currentTimeSignature.numerator;

    // Add remaining full measures
    measure += Math.floor(remainingTicks / ticksPerMeasure);

    // Calculate beat within measure
    const ticksIntoMeasure = remainingTicks % ticksPerMeasure;
    const beat = Math.floor(ticksIntoMeasure / ticksPerBeat);
    const ticksInBeat = ticksIntoMeasure % ticksPerBeat;

    return {
      measure,
      beat,
      ticksInBeat,
    };
  }

  getCurrentPosition(): {
    measure: number;
    beat: number;
    timeSignature: TimeSignatureChange;
  } | null {
    if (!this.isPlaying || !this.startTime) return null;

    const currentTime = this.audioContext.currentTime - this.startTime;
    let currentTick = 0;

    // Find current tick based on time
    for (const note of this.scheduledNotes) {
      if (note.time > currentTime) {
        break;
      }
      currentTick = note.time;
    }

    const position = this.getPositionAtTick(currentTick);
    const timeSignature = this.getTimeSignatureAtTick(currentTick);

    return {
      measure: position.measure,
      beat: position.beat,
      timeSignature,
    };
  }

  private ticksToSeconds(ticks: number): number {
    if (!this.midiData) return 0;

    const ticksPerBeat = this.midiData.header.ticksPerBeat ?? 96;
    let seconds = 0;
    let lastTempoChange = this.tempoChanges[0];
    let currentTick = 0;

    for (let i = 0; i < this.tempoChanges.length; i++) {
      const tempoChange = this.tempoChanges[i];

      if (ticks < tempoChange.tick) {
        // Calculate remaining time at current tempo
        const ticksDelta = ticks - currentTick;
        seconds +=
          (ticksDelta * lastTempoChange.tempo) / (ticksPerBeat * 1000000);
        break;
      }

      if (i + 1 < this.tempoChanges.length) {
        // Calculate time between tempo changes
        const ticksDelta = this.tempoChanges[i + 1].tick - currentTick;
        seconds += (ticksDelta * tempoChange.tempo) / (ticksPerBeat * 1000000);
        currentTick = this.tempoChanges[i + 1].tick;
        lastTempoChange = tempoChange;
      } else {
        // Calculate remaining time at last tempo
        const ticksDelta = ticks - currentTick;
        seconds += (ticksDelta * tempoChange.tempo) / (ticksPerBeat * 1000000);
      }
    }

    return seconds;
  }

  private prepareEvents(): void {
    if (!this.midiData?.tracks) return;

    this.scheduledNotes = [];

    this.midiData.tracks.forEach((track) => {
      let currentTick = 0;

      track.forEach((event) => {
        currentTick += event.deltaTime;

        if (event.type === "noteOn" || event.type === "noteOff") {
          const timeSeconds = this.ticksToSeconds(currentTick);
          const position = this.getPositionAtTick(currentTick);

          this.scheduledNotes.push({
            event,
            time: timeSeconds,
            processed: false,
            position, // Store position information
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
    this.startTime = this.audioContext.currentTime;
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
    if (this.schedulerTimer !== null) {
      window.clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    const now = this.audioContext.currentTime;

    // Immediately stop all active oscillators with a quick fadeout
    this.oscillators.forEach((oscillator, noteNumber) => {
      const gainNode = this.activeGainNodes.get(noteNumber);
      if (gainNode) {
        // Quick fadeout to avoid clicks
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.02);

        // Schedule the oscillator to stop after the fadeout
        setTimeout(() => {
          oscillator.stop();
          oscillator.disconnect();
          gainNode.disconnect();
        }, 25); // Slightly longer than the fadeout time
      }
    });

    // Clear all collections
    this.oscillators.clear();
    this.activeGainNodes.clear();

    // Reset all state
    this.isPlaying = false;
    this.currentTime = 0;
    this.startTime = null;
    this.resetEvents();

    // Cancel any scheduled events
    if (this.audioContext.state !== "closed") {
      this.audioContext
        .resume()
        .then(() => {
          this.audioContext
            .close()
            .then(() => {
              this.audioContext = new AudioContext();
            })
            .catch((error) => {
              console.error("Error closing audio context:", error);
            });
        })
        .catch((error) => {
          console.error("Error closing audio context:", error);
        });
    }
  }

  private scheduleNoteOn(event: MidiNoteOnEvent, playTime: number): void {
    const frequency = this.midiNoteToFrequency(event.noteNumber);
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, playTime);

    gainNode.gain.setValueAtTime(0, playTime);
    gainNode.gain.linearRampToValueAtTime(
      event.velocity / 127,
      playTime + 0.005,
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(playTime);
    this.oscillators.set(event.noteNumber, oscillator);
    this.activeGainNodes.set(event.noteNumber, gainNode);
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
