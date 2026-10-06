import { ArrowLeft, Clock, Hash, Lock, Users } from 'lucide-react';
import Avatar from '../Avatar';

const ChatHeader = ({ conversation, currentUserId, onBack }) => {
  if (!conversation) return null;

  const isChannel = conversation.type === 'CHANNEL';
  const isGroup = conversation.type === 'GROUP';
  const isPrivateChannel = isChannel && (conversation.isPrivate || conversation.channelType === 'PRIVATE');

  const otherParticipant = conversation.otherParticipant || conversation.participants?.find(
    (p) => String(p._id || p.id) !== String(currentUserId)
  );

  const renderIconOrAvatar = () => {
    if (isChannel) {
      return (
        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 font-extrabold ${
          isPrivateChannel ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-neutral-100 text-black border border-neutral-200'
        }`}>
          {isPrivateChannel ? <Lock className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
        </div>
      );
    }
    if (isGroup) {
      return (
        <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center shrink-0 font-extrabold">
          <Users className="w-5 h-5" />
        </div>
      );
    }
    return (
      <Avatar
        user={otherParticipant}
        size="h-10 w-10"
        className="border border-neutral-200 shrink-0"
      />
    );
  };

  const renderTitle = () => {
    if (isChannel) {
      return `${isPrivateChannel ? '🔒' : '#'} ${conversation.name}`;
    }
    if (isGroup) {
      return conversation.name || 'Group Chat';
    }
    return otherParticipant?.name || 'Teammate';
  };

  const renderSubtitle = () => {
    if (isChannel) {
      return conversation.description || `${conversation.participants?.length || 0} members · Teams Channel`;
    }
    if (isGroup) {
      return `${conversation.participants?.length || 0} members`;
    }
    return `${otherParticipant?.role || 'Employee'} · ${otherParticipant?.department || 'General'}`;
  };

  return (
    <div className="h-16 px-4 sm:px-6 bg-white border-b border-neutral-200 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-2xs">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer lg:hidden shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {renderIconOrAvatar()}

        <div className="min-w-0">
          <h3 className="font-extrabold text-sm text-black truncate flex items-center gap-1.5">
            <span>{renderTitle()}</span>
          </h3>
          <p className="text-xs text-neutral-500 font-semibold truncate">
            {renderSubtitle()}
          </p>
        </div>
      </div>

      {/* 24-Hour Expiration Banner Tag */}
      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 bg-neutral-100 px-3 py-1 rounded-xl border border-neutral-200 shrink-0">
        <Clock className="w-3.5 h-3.5 text-black" />
        <span>Messages expire in 24h</span>
      </div>
    </div>
  );
};

export default ChatHeader;
