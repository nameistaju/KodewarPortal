import { MessageSquare } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

const ChatWindow = ({
  conversation,
  messages = [],
  currentUserId,
  loadingMessages = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onSendText,
  onSendMedia,
  onBackMobile
}) => {
  if (!conversation) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full bg-[#FAFAFA] text-center p-8 border-l border-neutral-200">
        <div className="p-4 bg-white border border-neutral-200 rounded-3xl shadow-sm mb-4">
          <MessageSquare className="w-10 h-10 text-black stroke-[1.5]" />
        </div>
        <h3 className="text-xl font-black text-black">Your Conversations</h3>
        <p className="text-xs text-neutral-500 mt-2 max-w-sm font-medium leading-relaxed">
          Select a conversation from the sidebar or start a new chat with a teammate to communicate privately.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        onBack={onBackMobile}
      />

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        loading={loadingMessages}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
      />

      <MessageComposer
        onSendText={onSendText}
        onSendMedia={onSendMedia}
        disabled={loadingMessages}
      />
    </div>
  );
};

export default ChatWindow;
