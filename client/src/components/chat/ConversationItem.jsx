import Avatar from '../Avatar';
import { formatChatTimestamp, isMessageExpired } from '../../utils/chatTime';
import { Image, Mic } from 'lucide-react';

const ConversationItem = ({ conversation, currentUserId, isSelected, onClick }) => {
  const otherParticipant = conversation.otherParticipant || conversation.participants?.find(
    (p) => String(p._id || p.id) !== String(currentUserId)
  );

  const lastMsg = conversation.lastMessage;
  const isLastMsgExpired = lastMsg ? isMessageExpired(lastMsg.expiresAt) : true;
  const activeLastMsg = isLastMsgExpired ? null : lastMsg;

  const renderMessagePreview = () => {
    if (!activeLastMsg) {
      return <span className="text-neutral-400 italic">No active messages</span>;
    }

    if (activeLastMsg.messageType === 'IMAGE') {
      return (
        <span className="flex items-center gap-1 text-neutral-600 font-semibold">
          <Image className="w-3.5 h-3.5" />
          <span>Image {activeLastMsg.content ? `· ${activeLastMsg.content}` : ''}</span>
        </span>
      );
    }

    if (activeLastMsg.messageType === 'VOICE') {
      return (
        <span className="flex items-center gap-1 text-neutral-600 font-semibold">
          <Mic className="w-3.5 h-3.5" />
          <span>Voice Note</span>
        </span>
      );
    }

    return <span className="truncate">{activeLastMsg.content}</span>;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all text-left cursor-pointer border ${
        isSelected
          ? 'bg-black text-white border-black shadow-md'
          : 'bg-white text-black border-transparent hover:bg-neutral-100/70 hover:border-neutral-200'
      }`}
    >
      <Avatar
        user={otherParticipant}
        size="h-11 w-11"
        className={`shrink-0 ${isSelected ? 'border-2 border-white' : 'border border-neutral-200'}`}
        fallbackClassName={isSelected ? 'bg-white text-black' : 'bg-black text-white'}
      />

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-0.5">
          <h4 className={`font-extrabold text-sm truncate ${isSelected ? 'text-white' : 'text-black'}`}>
            {otherParticipant?.name || 'Teammate'}
          </h4>
          {activeLastMsg?.createdAt && (
            <span
              className={`text-[10px] font-semibold shrink-0 ${
                isSelected ? 'text-neutral-300' : 'text-neutral-400'
              }`}
            >
              {formatChatTimestamp(activeLastMsg.createdAt)}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center text-xs gap-2">
          <div
            className={`truncate font-medium ${
              isSelected ? 'text-neutral-300' : 'text-neutral-500'
            }`}
          >
            {renderMessagePreview()}
          </div>
          {otherParticipant?.department && (
            <span
              className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                isSelected ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {otherParticipant.department}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
