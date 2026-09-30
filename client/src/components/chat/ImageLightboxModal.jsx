import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';

const ImageLightboxModal = ({ imageUrl, altText, onClose }) => {
  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
        >
          <div className="absolute -top-12 right-0 flex items-center gap-3">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/80 hover:text-white bg-black/50 rounded-full cursor-pointer transition-colors"
              title="Open original image in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white bg-black/50 rounded-full cursor-pointer transition-colors"
              aria-label="Close image lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <img
            src={imageUrl}
            alt={altText || 'Expanded chat image'}
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-neutral-800"
          />
          {altText && (
            <p className="mt-3 text-sm text-neutral-300 font-semibold text-center max-w-lg truncate">
              {altText}
            </p>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ImageLightboxModal;
