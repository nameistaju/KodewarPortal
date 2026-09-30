import { useState } from 'react';
import { Search, Plus, MessageSquare } from 'lucide-react';
import ConversationItem from './ConversationItem';

const ConversationList = ({
  conversations = [],
  selectedConvId,
  onSelectConversation,
  onOpenNewChat,
  loading = false,
  currentUserId
}) => {
  const [search, setSearch] = useState('');

  const filteredConversations = conversations.filter((conv) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    const other = conv.otherParticipant || conv.participants?.find((p) => String(p._id || p.id) !== String(currentUserId));
    const nameMatch = other?.name?.toLowerCase().includes(term);
    const deptMatch = other?.department?.toLowerCase().includes(term);
    const msgMatch = conv.lastMessage?.content?.toLowerCase().includes(term);

    return nameMatch || deptMatch || msgMatch;
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200">
      {/* List Header */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-black" />
          <h2 className="text-lg font-black text-black tracking-tight">Messages</h2>
        </div>
        <button
          onClick={onOpenNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-neutral-100 bg-neutral-50/50">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teammate or department..."
            className="w-full pl-9 pr-4 py-2 bg-white text-black text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading ? (
          // Skeleton Loaders
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-100/60 animate-pulse">
              <div className="w-11 h-11 bg-neutral-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-neutral-200 rounded-md w-1/2" />
                <div className="h-3 bg-neutral-200 rounded-md w-3/4" />
              </div>
            </div>
          ))
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 space-y-3">
            <div className="p-4 bg-neutral-100 rounded-full text-neutral-400">
              <MessageSquare className="w-8 h-8 stroke-1" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-black">No conversations yet</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Start a private 1-to-1 conversation with a teammate.
              </p>
            </div>
            <button
              onClick={onOpenNewChat}
              className="btn-primary py-2 px-4 text-xs font-bold rounded-xl cursor-pointer"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv._id || conv.id}
              conversation={conv}
              currentUserId={currentUserId}
              isSelected={String(conv._id || conv.id) === String(selectedConvId)}
              onClick={() => onSelectConversation(conv._id || conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
