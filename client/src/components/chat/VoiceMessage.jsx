import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

const VoiceMessage = ({ mediaUrl, duration = 0, isOutgoing = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(mediaUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleOtherPlay = (e) => {
      if (e.detail?.audioId !== mediaUrl && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    window.addEventListener('kodewar:voice-play', handleOtherPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener('kodewar:voice-play', handleOtherPlay);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(
        new CustomEvent('kodewar:voice-play', { detail: { audioId: mediaUrl } })
      );
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatSecs = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = audioDuration ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl w-60 sm:w-64 select-none ${
        isOutgoing ? 'bg-black text-white' : 'bg-neutral-100 text-black border border-neutral-200'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 ${
          isOutgoing
            ? 'bg-white text-black hover:bg-neutral-200'
            : 'bg-black text-white hover:bg-neutral-800'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="relative w-full h-1.5 bg-neutral-300/40 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${isOutgoing ? 'bg-white' : 'bg-black'}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
          <input
            type="range"
            min={0}
            max={audioDuration || 1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono font-bold opacity-75">
          <span>{formatSecs(currentTime)}</span>
          <span>{formatSecs(audioDuration)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
