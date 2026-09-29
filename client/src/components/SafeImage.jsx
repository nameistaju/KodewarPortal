import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { assetUrl } from '../utils/assets';

const SafeImage = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  fallbackLabel = 'Image unavailable',
  imageClassName = '',
  ...props
}) => {
  const resolvedSrc = useMemo(() => assetUrl(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (resolvedSrc && !failed) {
    return (
      <img
        src={resolvedSrc}
        alt={alt || fallbackLabel}
        className={`${className} ${imageClassName}`.trim()}
        onError={() => setFailed(true)}
        {...props}
      />
    );
  }

  return (
    <div
      className={`${className} ${fallbackClassName} flex items-center justify-center gap-2 bg-slate-100 text-xs font-semibold text-slate-400`.trim()}
      role="img"
      aria-label={fallbackLabel}
      title={fallbackLabel}
    >
      <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{fallbackLabel}</span>
    </div>
  );
};

export default SafeImage;