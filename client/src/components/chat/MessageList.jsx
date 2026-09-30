import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { Loader2, ShieldAlert } from 'lucide-react';
import { isMessageExpired } from '../../utils/chatTime';

const MessageList = ({
  messages = [],
  currentUserId,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore
}) => {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Filter expired messages
  const activeMessages = (messages || []).filter((msg) => !isMessageExpired(msg.expiresAt));

  // Deduplicate messages by ID
  const uniqueMessages = Array.from(
    new Map(activeMessages.map((msg) => [String(msg._id || msg.id), msg])).values()
  );

  // Auto scroll to bottom when new messages arrive if near bottom
  useEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [uniqueMessages.length, shouldAutoScroll]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShouldAutoScroll(isAtBottom);

    // Scroll near top trigger load more
    if (container.scrollTop < 50 && hasMore && !loadingMore && onLoadMore) {
      const oldScrollHeight = container.scrollHeight;
      onLoadMore().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
        });
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-[#F9F9F9]"
    >
      {/* Loading older messages indicator */}
      {loadingMore && (
        <div className="flex justify-center py-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-white border border-neutral-200 rounded-full shadow-2xs text-xs font-bold text-neutral-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            <span>Loading older messages...</span>
          </div>
        </div>
      )}

      {loading && messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-12 text-neutral-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-black" />
          <span className="text-xs font-bold">Loading conversation messages...</span>
        </div>
      ) : uniqueMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-16 text-center text-neutral-400 space-y-2">
          <div className="p-3 bg-white border border-neutral-200 rounded-2xl">
            <ShieldAlert className="w-6 h-6 text-neutral-500" />
          </div>
          <div>
            <p className="font-extrabold text-sm text-black">No active messages</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs">
              Messages automatically expire after 24 hours. Send a message to start communicating.
            </p>
          </div>
        </div>
      ) : (
        uniqueMessages.map((msg) => (
          <MessageBubble
            key={msg._id || msg.id}
            message={msg}
            currentUserId={currentUserId}
          />
        ))
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
