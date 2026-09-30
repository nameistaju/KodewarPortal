import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

const ImagePreview = ({ file, onSend, onCancel }) => {
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const previewUrl = URL.createObjectURL(file);

  const handleSend = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setUploading(true);
    try {
      await onSend(file, caption);
    } catch {
      // Error handled by parent
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-3 bg-neutral-900 text-white rounded-2xl border border-neutral-800 w-full flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-300 truncate max-w-xs">
          {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
        </span>
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="p-1 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative rounded-xl overflow-hidden max-h-48 bg-black flex justify-center border border-neutral-800">
        <img src={previewUrl} alt="Preview" className="max-h-48 object-contain" />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add an optional caption..."
          className="flex-1 bg-neutral-800 text-white text-xs px-3 py-2 rounded-xl border border-neutral-700 focus:outline-none focus:border-white"
        />
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-black font-extrabold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};

export default ImagePreview;
