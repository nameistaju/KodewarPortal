import { useEffect, useRef, useState } from 'react';
import { Square, Trash2, Play, Pause, Send, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const VoiceRecorder = ({ onSend, onCancel, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewAudioRef = useRef(null);

  useEffect(() => {
    startRecordingProcess();

    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startTimer = () => {
    stopTimer();
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 119) {
          stopRecording();
          return 120;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecordingProcess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size > 5 * 1024 * 1024) {
            toast.error('Voice note exceeds 5MB limit');
            onCancel?.();
            return;
          }
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      startTimer();
    } catch (err) {
      toast.error('Microphone permission denied or not supported by browser');
      onCancel?.();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const handleSend = async () => {
    if (!recordedBlob || uploading) return;
    setUploading(true);

    try {
      const fileExt = recordedBlob.type.includes('mp4')
        ? 'm4a'
        : recordedBlob.type.includes('ogg')
          ? 'ogg'
          : 'webm';
      const file = new File([recordedBlob], `voice-note-${Date.now()}.${fileExt}`, {
        type: recordedBlob.type
      });

      await onSend(file, seconds);
    } catch {
      // Error handled by parent
    } finally {
      setUploading(false);
    }
  };

  const togglePreviewPlay = () => {
    if (!audioUrl) return;

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(audioUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 p-2.5 bg-neutral-900 text-white rounded-2xl border border-neutral-800 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
      {isRecording ? (
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            title="Cancel recording"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 font-mono text-sm font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>{formatTimer(seconds)}</span>
            <span className="text-[10px] text-neutral-400 font-sans font-normal ml-1">
              (Max 2:00)
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            title="Delete voice note"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-2 bg-white text-black hover:bg-neutral-200 rounded-xl cursor-pointer transition-colors"
            >
              {isPlayingPreview ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <span className="font-mono text-xs font-bold text-neutral-300">
              {formatTimer(seconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-extrabold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send Voice</span>
          </button>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;
