import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getConversations,
  createConversation,
  getMessages,
  sendTextMessage,
  sendMediaMessage
} from '../api/chatApi';
import { getErrorMessage } from '../api/helpers';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import NewChatModal from '../components/chat/NewChatModal';
import { isMessageExpired } from '../utils/chatTime';

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?._id || user?.id || user?.employeeId;

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const pollIntervalRef = useRef(null);

  // 1. Fetch user conversations (Guarded by authenticated user ID)
  const fetchUserConversations = useCallback(async (silent = false) => {
    if (!currentUserId) return;

    if (!silent) setLoadingConvs(true);
    try {
      const data = await getConversations();
      const list = data.conversations || [];
      setConversations(list);

      // Auto-select first conversation on initial load if none selected
      if (list.length > 0 && !selectedConvId) {
        setSelectedConvId((prev) => prev || list[0]._id || list[0].id);
      }
    } catch (err) {
      console.error('Failed to load user conversations:', err);
      if (!silent) toast.error(getErrorMessage(err) || 'Failed to load conversations');
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  }, [currentUserId]);

  // Execute conversation load once auth is resolved and currentUserId exists
  useEffect(() => {
    if (authLoading) return;

    if (currentUserId) {
      fetchUserConversations();
    } else {
      setLoadingConvs(false);
    }
  }, [authLoading, currentUserId, fetchUserConversations]);

  // 2. Fetch messages for active conversation
  const fetchMessagesForConv = useCallback(
    async (convId, pageNum = 1, appendOld = false) => {
      if (!convId) return;

      if (!appendOld) {
        setLoadingMsgs(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await getMessages(convId, pageNum, 30);
        const fetchedItems = data.items || [];
        const activeItems = fetchedItems.filter((msg) => !isMessageExpired(msg.expiresAt));

        if (appendOld) {
          setMessages((prev) => {
            const combined = [...activeItems, ...prev];
            // Deduplicate
            return Array.from(
              new Map(combined.map((m) => [String(m._id || m.id), m])).values()
            );
          });
        } else {
          setMessages(activeItems);
        }

        if (data.pagination) {
          setPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        if (!appendOld) toast.error(getErrorMessage(err) || 'Failed to load messages');
      } finally {
        setLoadingMsgs(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // When selected conversation changes
  useEffect(() => {
    if (selectedConvId) {
      fetchMessagesForConv(selectedConvId, 1, false);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessagesForConv]);

  // 3. Realtime / Polling update every 3.5 seconds
  useEffect(() => {
    if (!currentUserId || authLoading) return;

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(() => {
      fetchUserConversations(true);
      if (selectedConvId) {
        getMessages(selectedConvId, 1, 30)
          .then((data) => {
            const newItems = (data.items || []).filter((msg) => !isMessageExpired(msg.expiresAt));
            setMessages((prev) => {
              const map = new Map();
              // Keep existing or incoming
              [...prev, ...newItems].forEach((m) => {
                if (!isMessageExpired(m.expiresAt)) {
                  map.set(String(m._id || m.id), m);
                }
              });
              return Array.from(map.values());
            });
          })
          .catch((err) => {
            console.error('Polling error:', err);
          });
      }
    }, 3500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentUserId, authLoading, selectedConvId, fetchUserConversations]);

  // 4. Handle pagination load more
  const handleLoadMore = async () => {
    if (page < totalPages && !loadingMore && selectedConvId) {
      await fetchMessagesForConv(selectedConvId, page + 1, true);
    }
  };

  // 5. Handle Start New Chat
  const handleSelectRecipient = async (recipientId) => {
    try {
      const data = await createConversation(recipientId);
      const conv = data.conversation;
      if (conv) {
        const convId = conv._id || conv.id;
        await fetchUserConversations(true);
        setSelectedConvId(convId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not start conversation');
      throw err;
    }
  };

  // 6. Handle Send Text Message
  const handleSendText = async (content) => {
    if (!selectedConvId) return;

    try {
      const data = await sendTextMessage(selectedConvId, content);
      const newMsg = data.message;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
        fetchUserConversations(true);
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || "Message couldn't be sent. Please try again.");
      throw err;
    }
  };

  // 7. Handle Send Media Message (Image or Voice Note)
  const handleSendMedia = async (file, messageType, content = '', duration = 0) => {
    if (!selectedConvId) return;

    try {
      const data = await sendMediaMessage(selectedConvId, file, messageType, content, duration);
      const newMsg = data.message;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
        fetchUserConversations(true);
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || "Media message couldn't be sent. Please try again.");
      throw err;
    }
  };

  const activeConversation = conversations.find(
    (c) => String(c._id || c.id) === String(selectedConvId)
  );

  return (
    <div className="h-[calc(100vh-5rem)] lg:h-[calc(100vh-4.5rem)] rounded-3xl overflow-hidden border border-neutral-200 bg-white shadow-sm flex">
      {/* Sidebar Conversation List (Desktop always visible, Mobile hidden when conversation selected) */}
      <div
        className={`w-full lg:w-96 shrink-0 h-full ${
          selectedConvId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedConvId={selectedConvId}
          onSelectConversation={(id) => setSelectedConvId(id)}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          loading={loadingConvs}
          currentUserId={currentUserId}
        />
      </div>

      {/* Main Chat Window (Desktop always visible, Mobile visible when conversation selected) */}
      <div
        className={`flex-1 h-full min-w-0 ${
          selectedConvId ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <ChatWindow
          conversation={activeConversation}
          messages={messages}
          currentUserId={currentUserId}
          loadingMessages={loadingMsgs}
          loadingMore={loadingMore}
          hasMore={page < totalPages}
          onLoadMore={handleLoadMore}
          onSendText={handleSendText}
          onSendMedia={handleSendMedia}
          onBackMobile={() => setSelectedConvId(null)}
        />
      </div>

      {/* New Chat Selection Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectRecipient={handleSelectRecipient}
      />
    </div>
  );
};

export default Chat;
