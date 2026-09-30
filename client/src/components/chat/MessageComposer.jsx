import { useRef, useState } from 'react';
import { Image, Mic, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ImagePreview from './ImagePreview';
import VoiceRecorder from './VoiceRecorder';

const MessageComposer = ({ onSendText, onSendMedia, disabled = false }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef(null);

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || sending || disabled) return;

    if (cleanText.length > 2000) {
      toast.error('Message cannot exceed 2000 characters');
      return;
    }

    setSending(true);
    try {
      await onSendText(cleanText);
      setText('');
    } catch {
      // Handled by parent
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WEBP image uploads are allowed');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB');
      e.target.value = '';
      return;
    }

    setSelectedImage(file);
    e.target.value = '';
  };

  const handleSendImage = async (file, caption) => {
    await onSendMedia(file, 'IMAGE', caption);
    setSelectedImage(null);
  };

  const handleSendVoice = async (file, duration) => {
    await onSendMedia(file, 'VOICE', '', duration);
    setIsRecordingVoice(false);
  };

  if (selectedImage) {
    return (
      <div className="p-3 border-t border-neutral-200 bg-white">
        <ImagePreview
          file={selectedImage}
          onSend={handleSendImage}
          onCancel={() => setSelectedImage(null)}
        />
      </div>
    );
  }

  if (isRecordingVoice) {
    return (
      <div className="p-3 border-t border-neutral-200 bg-white">
        <VoiceRecorder
          onSend={handleSendVoice}
          onCancel={() => setIsRecordingVoice(false)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 border-t border-neutral-200 bg-white">
      <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          className="p-2.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Attach image"
          aria-label="Attach image"
        >
          <Image className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsRecordingVoice(true)}
          disabled={disabled || sending}
          className="p-2.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Record voice note"
          aria-label="Record voice note"
        >
          <Mic className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          disabled={disabled || sending}
          className="flex-1 bg-neutral-100 text-black text-sm px-4 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-black transition-colors"
        />

        <button
          type="submit"
          disabled={!text.trim() || sending || disabled}
          className="p-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-all cursor-pointer shrink-0"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;
