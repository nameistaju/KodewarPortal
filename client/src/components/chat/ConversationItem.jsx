import Avatar from '../Avatar';
import { formatChatTimestamp, isMessageExpired } from '../../utils/chatTime';
import { Image, Mic, Hash, Lock, Users } from 'lucide-react';

const ConversationItem = ({ conversation, currentUserId, isSelected, onClick }) => {
  const isChannel = conversation.type === 'CHANNEL';
  const isGroup = conversation.type === 'GROUP';
  const isPrivateChannel = isChannel && (conversation.isPrivate || conversation.channelType === 'PRIVATE');

  const otherParticipant = conversation.otherParticipant || conversation.participants?.find(
    (p) => String(p._id || p.id) !== String(currentUserId)
  );

  const lastMsg = conversation.lastMessage;
  const isLastMsgExpired = lastMsg ? isMessageExpired(lastMsg.expiresAt) : true;
  const activeLastMsg = isLastMsgExpired ? null : lastMsg;

  const renderTitle = () => {
    if (isChannel) {
      return (
        <span className="flex items-center gap-1">
          <span className="font-extrabold">{isPrivateChannel ? '🔒' : '#'}</span>
          <span>{conversation.name}</span>
        </span>
      );
    }
    if (isGroup) {
      return conversation.name || 'Group Chat';
    }
    return otherParticipant?.name || 'Teammate';
  };

  const renderIconOrAvatar = () => {
    if (isChannel) {
      return (
        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-base transition-colors ${
            isSelected
              ? 'bg-white text-black'
              : isPrivateChannel
              ? 'bg-amber-100 text-amber-900 border border-amber-200'
              : 'bg-neutral-100 text-black border border-neutral-200'
          }`}
        >
          {isPrivateChannel ? <Lock className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
        </div>
      );
    }

    if (isGroup) {
      return (
        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-base transition-colors ${
            isSelected
              ? 'bg-white text-black'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <Users className="w-5 h-5" />
        </div>
      );
    }

    return (
      <Avatar
        user={otherParticipant}
        size="h-11 w-11"
        className={`shrink-0 ${isSelected ? 'border-2 border-white' : 'border border-neutral-200'}`}
        fallbackClassName={isSelected ? 'bg-white text-black' : 'bg-black text-white'}
      />
    );
  };

  const renderMessagePreview = () => {
    if (!activeLastMsg) {
      return <span className="text-neutral-400 italic">No active messages</span>;
    }

    const senderName = activeLastMsg.sender?.name ? `${activeLastMsg.sender.name.split(' ')[0]}: ` : '';

    if (activeLastMsg.messageType === 'IMAGE') {
      return (
        <span className="flex items-center gap-1 text-neutral-600 font-semibold">
          <Image className="w-3.5 h-3.5" />
          <span>{senderName}Image {activeLastMsg.content ? `· ${activeLastMsg.content}` : ''}</span>
        </span>
      );
    }

    if (activeLastMsg.messageType === 'VOICE') {
      return (
        <span className="flex items-center gap-1 text-neutral-600 font-semibold">
          <Mic className="w-3.5 h-3.5" />
          <span>{senderName}Voice Note</span>
        </span>
      );
    }

    return <span className="truncate">{senderName}{activeLastMsg.content}</span>;
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
      {renderIconOrAvatar()}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2 mb-0.5">
          <h4 className={`font-extrabold text-sm truncate ${isSelected ? 'text-white' : 'text-black'}`}>
            {renderTitle()}
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
          {!isChannel && !isGroup && otherParticipant?.department && (
            <span
              className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                isSelected ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {otherParticipant.department}
            </span>
          )}
          {isChannel && (
            <span
              className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                isSelected
                  ? 'bg-neutral-800 text-white'
                  : isPrivateChannel
                  ? 'bg-amber-100 text-amber-900 font-black'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {isPrivateChannel ? 'PRIVATE' : 'PUBLIC'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
