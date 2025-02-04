// src/components/MidiFileInput.tsx
import React, { useCallback, useState } from "react";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { read } from "midifile-ts";

interface MidiFileInputProps {
  className?: string;
}

export const MidiFileInput: React.FC<MidiFileInputProps> = ({ className }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setMidiFile = useMidiStore((state) => state.setMidiFile);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file type
      if (
        !file.name.toLowerCase().endsWith(".mid") &&
        !file.type.includes("audio/midi")
      ) {
        setError("Please select a MIDI file (.mid)");
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const midiFile = read(new Uint8Array(arrayBuffer));
        setMidiFile(midiFile);
      } catch (err) {
        setError("Invalid MIDI file format");
        console.error("Error parsing MIDI file:", err);
      }
    },
    [setMidiFile],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        await handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files?.[0]) {
        await handleFile(e.target.files[0]);
      }
    },
    [handleFile],
  );

  return (
    <div className={className}>
      <div
        className={`midi-drop-zone ${dragActive ? "active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".mid,.midi"
          onChange={handleChange}
          className="file-input"
        />
        <p>Drag and drop a MIDI file here or click to select</p>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
};
