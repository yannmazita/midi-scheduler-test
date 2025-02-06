// src/components/Test.tsx
import React, { useRef, useCallback } from "react";
import { useAppStore } from "@/core/stores/appStore";

export const Test = () => {
  // Named export for component
  const midiFileName = useAppStore((state) => state.midiFileName);
  const midiHeader = useAppStore((state) => state.midiHeader);
  const midiTracks = useAppStore((state) => state.midiTracks);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const isPaused = useAppStore((state) => state.isPaused);
  const loadMidiFile = useAppStore((state) => state.loadMidiFile);
  const togglePlayPauseMidi = useAppStore((state) => state.togglePlayPauseMidi);
  const stopMidi = useAppStore((state) => state.stopMidi);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        const file = event.target.files[0];
        try {
          await loadMidiFile(file);
        } catch (error) {
          console.error("Error loading MIDI file in component:", error);
          alert(
            "Failed to load MIDI file. Please check the console for details.",
          );
        }
      }
    },
    [loadMidiFile],
  );

  const handleLoadButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePlayPauseClick = useCallback(() => {
    // Combined play/pause handler
    togglePlayPauseMidi();
  }, [togglePlayPauseMidi]);

  return (
    <div>
      <h1>MIDI Scheduling Test</h1>
      <p>MIDI File Name: {midiFileName}</p>
      {midiHeader && (
        <div>
          <h2>MIDI Header Information</h2>
          <p>Format: {midiHeader.format}</p>
          <p>Tracks: {midiHeader.numTracks}</p>
          {midiHeader.ticksPerBeat && (
            <p>Ticks per Beat: {midiHeader.ticksPerBeat}</p>
          )}
          {midiHeader.framesPerSecond && (
            <p>Frames per Second: {midiHeader.framesPerSecond}</p>
          )}
          {midiHeader.ticksPerFrame && (
            <p>Ticks per Frame: {midiHeader.ticksPerFrame}</p>
          )}
        </div>
      )}
      {midiTracks && midiTracks.length > 0 && (
        <div>
          <h2>MIDI Tracks</h2>
          <ul>
            {midiTracks.map((track, index) => (
              <li key={index}>
                Track {index + 1}: {track.length} events
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>Is Playing: {isPlaying ? "Yes" : "No"}</p>
      <p>Is Paused: {isPaused ? "Yes" : "No"}</p>

      <input
        type="file"
        accept=".mid,.midi"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button onClick={handleLoadButtonClick}>Load MIDI File</button>
      <button onClick={handlePlayPauseClick}>
        {" "}
        {/* Updated button */}
        {isPlaying ? "Pause" : isPaused ? "Resume" : "Play"}
      </button>
      <button onClick={stopMidi}>Stop</button>
    </div>
  );
};
