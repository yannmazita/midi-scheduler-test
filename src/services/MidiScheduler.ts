// src/services/MidiScheduler.ts
import { AnyEvent, MidiFile } from "midifile-ts";

export class MidiScheduler {
  private audioContext: AudioContext;
  private scheduledEvents = new Set<number>();
  private nextEventIndex = 0;
  private events: AnyEvent[] = [];
  private startTime = 0;
  private ticksPerBeat = 480;
  private tempo = 120;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  loadMidiFile(midiFile: MidiFile) {
    this.events = this.flattenMidiTracks(midiFile);
    this.ticksPerBeat = midiFile.header.ticksPerBeat;
    this.reset();
  }

  private flattenMidiTracks(midiFile: MidiFile): AnyEvent[] {
    const events = midiFile.tracks.flat();
    return events.sort((a, b) => a.deltaTime - b.deltaTime);
  }

  reset() {
    this.scheduledEvents.clear();
    this.nextEventIndex = 0;
    this.startTime = this.audioContext.currentTime;
  }

  schedule(lookAheadTime: number) {
    const currentTime = this.audioContext.currentTime - this.startTime;
    const lookAheadEnd = currentTime + lookAheadTime;

    while (this.nextEventIndex < this.events.length) {
      const event = this.events[this.nextEventIndex];
      const eventTime = this.ticksToSeconds(event.deltaTime);

      if (eventTime > lookAheadEnd) break;

      if (!this.scheduledEvents.has(this.nextEventIndex)) {
        this.scheduleEvent(event, eventTime);
        this.scheduledEvents.add(this.nextEventIndex);
      }

      this.nextEventIndex++;
    }
  }

  private ticksToSeconds(ticks: number): number {
    const beatsPerSecond = this.tempo / 60;
    const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
    return ticks / ticksPerSecond;
  }

  private scheduleEvent(event: AnyEvent, time: number) {
    if (event.type === "channel" && event.subtype === "noteOn") {
      this.scheduleNote(event, time);
    }
  }

  private scheduleNote(event: any, time: number) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const frequency = 440 * Math.pow(2, (event.noteNumber - 69) / 12);
    oscillator.frequency.value = frequency;

    const velocity = event.velocity / 127;
    gainNode.gain.value = velocity;

    const startTime = this.startTime + time;
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.1); // Note duration
  }
}
