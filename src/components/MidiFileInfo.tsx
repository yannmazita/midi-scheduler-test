// src/components/MidiFileInfo.tsx
import React from "react";
import { useMidiStore } from "@/core/stores/useMidiStore";

export const MidiFileInfo: React.FC = () => {
  const { midiFile, fileName } = useMidiStore();

  if (!midiFile) return null;

  return (
    <div className="midi-file-info">
      <h3>Loaded MIDI File: {fileName ?? "Untitled"}</h3>
      <div className="midi-details">
        <p>Format Type: {midiFile.header.formatType}</p>
        <p>Tracks: {midiFile.header.trackCount}</p>
        <p>Ticks per Beat: {midiFile.header.ticksPerBeat}</p>
        <p>
          Total Events:{" "}
          {midiFile.tracks.reduce((sum, track) => sum + track.length, 0)}
        </p>
      </div>
    </div>
  );
};
