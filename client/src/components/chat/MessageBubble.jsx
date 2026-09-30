import { useState } from 'react';
import Avatar from '../Avatar';
import VoiceMessage from './VoiceMessage';
import ImageLightboxModal from './ImageLightboxModal';
import { formatChatTimestamp, isMessageExpired } from '../../utils/chatTime';

const MessageBubble = ({ message, currentUserId }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!message || isMessageExpired(message.expiresAt)) {
    return null;
  }

  const isOutgoing = String(message.senderId || message.sender?._id || message.sender?.id) === String(currentUserId);
  const senderName = message.sender?.name || 'Employee';
  const formattedTime = formatChatTimestamp(message.createdAt);

  return (
    <div className={`flex gap-3 my-2 text-sm ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {!isOutgoing && (
        <Avatar
          user={message.sender}
          size="h-8 w-8"
          className="mt-1 shrink-0 border border-neutral-200"
          fallbackClassName="text-[10px] bg-black text-white"
        />
      )}

      <div className={`flex flex-col max-w-[78%] sm:max-w-[65%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
        {!isOutgoing && (
          <span className="text-[11px] font-bold text-neutral-500 mb-1 px-1">{senderName}</span>
        )}

        {/* TEXT MESSAGE */}
        {message.messageType === 'TEXT' && (
          <div
            className={`px-4 py-2.5 rounded-2xl break-words whitespace-pre-wrap font-medium shadow-2xs leading-relaxed ${
              isOutgoing
                ? 'bg-black text-white rounded-br-xs'
                : 'bg-white text-black border border-neutral-200 rounded-bl-xs'
            }`}
          >
            {message.content}
          </div>
        )}

        {/* IMAGE MESSAGE */}
        {message.messageType === 'IMAGE' && (
          <div className="flex flex-col gap-1.5">
            {message.mediaUrl && (
              <div
                onClick={() => setLightboxOpen(true)}
                className="relative rounded-2xl overflow-hidden cursor-pointer border border-neutral-200 shadow-sm max-w-xs sm:max-w-sm group"
              >
                <img
                  src={message.mediaUrl}
                  alt={message.content || 'Chat image'}
                  className="max-h-60 sm:max-h-72 w-full object-cover transition-transform group-hover:scale-102 duration-200"
                />
              </div>
            )}
            {message.content && (
              <div
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isOutgoing
                    ? 'bg-black text-white'
                    : 'bg-neutral-100 text-black border border-neutral-200'
                }`}
              >
                {message.content}
              </div>
            )}
          </div>
        )}

        {/* VOICE MESSAGE */}
        {message.messageType === 'VOICE' && (
          <VoiceMessage
            mediaUrl={message.mediaUrl}
            duration={message.mediaDuration}
            isOutgoing={isOutgoing}
          />
        )}

        {/* TIMESTAMP */}
        <span className="text-[10px] text-neutral-400 font-medium mt-1 px-1">
          {formattedTime}
        </span>
      </div>

      {lightboxOpen && (
        <ImageLightboxModal
          imageUrl={message.mediaUrl}
          altText={message.content}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default MessageBubble;
