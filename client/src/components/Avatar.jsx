import { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '../utils/assets';

const initialsFor = (name = '') => {
  const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || 'U';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return `${first}${second}`.toUpperCase();
};

const Avatar = ({
  user,
  employee,
  name,
  photo,
  size = 'h-10 w-10',
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  rounded = 'rounded-full',
  alt
}) => {
  const subject = user || employee || {};
  const displayName = name || subject.name || 'User';
  const rawUrl = photo?.url || photo || subject.profilePhoto?.url || '';
  const src = useMemo(() => assetUrl(rawUrl), [rawUrl]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const baseClass = `${size} ${rounded} shrink-0 overflow-hidden ${className}`.trim();

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt || displayName}
        className={`${baseClass} object-cover ${imageClassName}`.trim()}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${baseClass} inline-flex items-center justify-center bg-neutral-900 text-white font-extrabold ${fallbackClassName}`.trim()}
      aria-label={alt || displayName}
      title={displayName}
    >
      {initialsFor(displayName)}
    </span>
  );
};

export default Avatar;
