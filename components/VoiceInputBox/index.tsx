import { useEffect, useRef, useState } from "react";
import { useWhisper } from "@hzstudio/use-whisper";

import { MicIcon, EarIcon, SendIcon, LoadbarSound } from "@/components/Icons";
import LoadingDots from "@/components/LoadingDots";
import { useCountdown, format } from "@/hooks/useCountdown";
import { useAutosizeTextArea } from "@/hooks/useAutosizeTextArea";

const onTranscribe = async (blob: Blob) => {
  try {
    console.log("Starting transcription process...");
    console.log("Original blob size:", blob.size, "bytes");
    console.log("Original blob type:", blob.type);

    // Convert blob to WAV format for better compatibility
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log("Audio context created");
    
    const arrayBuffer = await blob.arrayBuffer();
    console.log("Array buffer created, size:", arrayBuffer.byteLength, "bytes");
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log("Audio buffer decoded:", {
      duration: audioBuffer.duration,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate
    });
    
    // Create WAV file
    const wavBlob = await audioBufferToWav(audioBuffer);
    console.log("WAV blob created:", {
      size: wavBlob.size,
      type: wavBlob.type
    });

    // Create a File object from the WAV blob
    const file = new File([wavBlob], "speech.wav", { type: "audio/wav" });
    console.log("File created:", {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Create FormData and append the file
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    console.log("Sending request to Whisper API...");
    const response = await fetch("/api/whisper", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Whisper API error response:", error);
      throw new Error(error.error || "Failed to transcribe audio");
    }

    const { text } = await response.json();
    console.log("Transcription result:", text);
    return {
      blob,
      text,
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

// Helper function to convert AudioBuffer to WAV format
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
  const view = new DataView(wav);

  // WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.length * blockAlign, true);

  // Write audio data
  const data = new Float32Array(buffer.length);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    data[i] = channel[i];
  }
  floatTo16BitPCM(view, 44, data);

  return new Blob([wav], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (view: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

interface VoiceInputBoxProps {
  isLoading?: boolean;
  onSend?: (text?: string) => void;
  onError?: (error: Error) => void;
}

export default function VoiceInputBox({
  isLoading,
  onSend,
  onError,
}: VoiceInputBoxProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useAutosizeTextArea(textAreaRef.current, value);

  const {
    recording,
    speaking,
    transcribing,
    transcript,
    startRecording,
    stopRecording,
  } = useWhisper({
    onTranscribe,
    nonStop: true,
    stopTimeout: 3000,
    whisperConfig: {
      language: "en",
    },
  });

  useEffect(() => {
    if (transcript.text) {
      setValue((prev) => prev + " " + transcript.text);
      setError(null);
    }
  }, [transcript.text]);

  const handleStartRecording = async () => {
    try {
      console.log("Starting recording...");
      setError(null);
      setValue("");
      await startRecording();
      console.log("Recording started successfully");
      start();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError("Failed to start recording. Please check microphone permissions.");
      onError?.(error as Error);
    }
  };

  const onEnd = () => {
    if (!recording) return;
    console.log("Stopping recording...");
    stopRecording();
    console.log("Recording stopped");
  };

  const { countDown, start, stop, isStart } = useCountdown(30, {
    autoStart: false,
    onEnd,
  });
  const { m, s } = format(countDown);

  const handleSend = () => {
    if (recording) {
      stopRecording();
    }
    if (value.trim()) {
      onSend?.(value);
      setValue("");
      setError(null);
    }
  };

  useEffect(() => {
    if (!isStart) return;
    const tick = setTimeout(() => {
      if (!recording) {
        stop();
      }
    }, 100);
    return () => clearTimeout(tick);
  }, [recording, stop, isStart]);

  useEffect(() => {
    if (recording && transcribing) {
      stopRecording();
    }
  }, [recording, transcribing, stopRecording]);

  const handleEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey === false) {
      handleSend();
    }
  };

  const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = evt.target?.value;
    setValue(val);
    setError(null);
  };

  return (
    <>
      <div className="border border-slate-300 rounded p-2 mt-4 flex w-full gap-2">
        <div className="flex-grow">
          <p>
            <textarea
              className="w-full h-full bg-transparent resize-none px-4 py-2 border border-dashed rounded outline-none ring-slate-300 focus:ring disabled:opacity-50"
              ref={textAreaRef}
              onKeyDown={handleEnter}
              disabled={recording || transcribing || speaking}
              autoFocus={false}
              rows={3}
              value={value}
              onChange={handleChange}
              spellCheck={true}
              lang="en"
              placeholder={isLoading ? "Waiting for response..." : ""}
            />
          </p>
          {error && (
            <p className="text-red-500 text-sm mt-1">{error}</p>
          )}
          <div className="flex justify-left py-2">
            <p className="flex items-center mr-8">
              <span className="text-slate-500 mr-2">Speaking:</span>
              {speaking ? (
                <IconButton className="text-red-500">
                  <LoadbarSound />
                </IconButton>
              ) : (
                <span className="text-slate-300">None</span>
              )}
            </p>
            <p className="flex items-center">
              <span className="text-slate-500 mr-2">Transcribing:</span>
              {transcribing ? (
                <IconButton>
                  <LoadingDots color="#f00" />
                </IconButton>
              ) : (
                <span className="text-slate-300">None</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col w-10 items-center text-slate-500">
          {isLoading ? (
            <IconButton>
              <LoadingDots color="#000" />
            </IconButton>
          ) : (
            <>
              <IconButton onClick={handleSend}>
                <SendIcon />
              </IconButton>
              <IconButton onClick={handleStartRecording}>
                {recording ? <EarIcon /> : <MicIcon />}
              </IconButton>
              {countDown > 0 && isStart && recording ? (
                <div
                  className={`text-right text-xs px-1 ${
                    countDown < 5 ? "text-red-500" : ""
                  }`}
                >
                  {m}:{s}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const IconButton = ({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"button">) => (
  <button
    type="button"
    className="flex justify-center items-center w-8 h-8 p-1 hover:bg-slate-100 hover:rounded"
    {...props}
  >
    {children}
  </button>
);
