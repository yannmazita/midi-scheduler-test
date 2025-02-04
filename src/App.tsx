// src/App.tsx
import React from "react";
import { MidiFileInput } from "./components/MidiFileInput";
import { MidiFileInfo } from "./components/MidiFileInfo";
import { Transport } from "./components/Transport";
import { useMidiStore } from "@/core/stores/useMidiStore";

export const App: React.FC = () => {
  const midiFile = useMidiStore((state) => state.midiFile);

  return (
    <div className="app">
      <h1>MIDI Player</h1>
      <MidiFileInput className="" />
      {midiFile && (
        <>
          <MidiFileInfo />
          <Transport />
        </>
      )}
    </div>
  );
};

export default App;
