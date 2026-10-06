import { useState } from 'react';
import { Search, Plus, MessageSquare, Hash, Users, User, ChevronDown, ChevronRight } from 'lucide-react';
import ConversationItem from './ConversationItem';

const ConversationList = ({
  conversations = [],
  selectedConvId,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewChannel,
  loading = false,
  currentUserId
}) => {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState({
    channels: true,
    directs: true,
    groups: true
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredConversations = conversations.filter((conv) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    if (conv.type === 'CHANNEL' || conv.type === 'GROUP') {
      const nameMatch = conv.name?.toLowerCase().includes(term);
      const descMatch = conv.description?.toLowerCase().includes(term);
      const msgMatch = conv.lastMessage?.content?.toLowerCase().includes(term);
      return nameMatch || descMatch || msgMatch;
    }

    const other = conv.otherParticipant || conv.participants?.find((p) => String(p._id || p.id) !== String(currentUserId));
    const nameMatch = other?.name?.toLowerCase().includes(term);
    const deptMatch = other?.department?.toLowerCase().includes(term);
    const msgMatch = conv.lastMessage?.content?.toLowerCase().includes(term);

    return nameMatch || deptMatch || msgMatch;
  });

  const channels = filteredConversations.filter((c) => c.type === 'CHANNEL');
  const directs = filteredConversations.filter((c) => c.type === 'DIRECT' || !c.type);
  const groups = filteredConversations.filter((c) => c.type === 'GROUP');

  return (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200">
      {/* List Header */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-black" />
          <h2 className="text-lg font-black text-black tracking-tight">Teams Chat</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenNewChannel && (
            <button
              onClick={onOpenNewChannel}
              title="Create Channel or Group"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>+ Channel</span>
            </button>
          )}
          <button
            onClick={onOpenNewChat}
            title="Start New Direct Chat"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-neutral-100 bg-neutral-50/50">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels, teammates..."
            className="w-full pl-9 pr-4 py-2 bg-white text-black text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
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
              <h3 className="font-extrabold text-sm text-black">No conversations found</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Join a channel or start a private chat with a teammate.
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
          <>
            {/* 1. CHANNELS SECTION */}
            {channels.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('channels')}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-black cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Channels ({channels.length})</span>
                  </span>
                  {openSections.channels ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {openSections.channels && (
                  <div className="mt-1 space-y-1">
                    {channels.map((conv) => (
                      <ConversationItem
                        key={conv._id || conv.id}
                        conversation={conv}
                        currentUserId={currentUserId}
                        isSelected={String(conv._id || conv.id) === String(selectedConvId)}
                        onClick={() => onSelectConversation(conv._id || conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. DIRECT MESSAGES SECTION */}
            {directs.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('directs')}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-black cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Direct Messages ({directs.length})</span>
                  </span>
                  {openSections.directs ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {openSections.directs && (
                  <div className="mt-1 space-y-1">
                    {directs.map((conv) => (
                      <ConversationItem
                        key={conv._id || conv.id}
                        conversation={conv}
                        currentUserId={currentUserId}
                        isSelected={String(conv._id || conv.id) === String(selectedConvId)}
                        onClick={() => onSelectConversation(conv._id || conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. GROUPS SECTION */}
            {groups.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('groups')}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-black cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Groups ({groups.length})</span>
                  </span>
                  {openSections.groups ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {openSections.groups && (
                  <div className="mt-1 space-y-1">
                    {groups.map((conv) => (
                      <ConversationItem
                        key={conv._id || conv.id}
                        conversation={conv}
                        currentUserId={currentUserId}
                        isSelected={String(conv._id || conv.id) === String(selectedConvId)}
                        onClick={() => onSelectConversation(conv._id || conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
