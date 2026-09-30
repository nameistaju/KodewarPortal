import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { mapEmployeeFromDb } from '../utils/supabaseHelpers.js';
import { uploadChatMediaBuffer, deleteChatMedia } from './uploadService.js';

const mapMessageFromDb = (row, senderMap = {}) => {
  if (!row) return null;
  const senderInfo = senderMap[row.sender_id] || { id: row.sender_id };

  return {
    _id: String(row.id),
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    sender: senderInfo,
    messageType: row.message_type || 'TEXT',
    content: row.content || null,
    mediaUrl: row.media_url || null,
    mediaPublicId: row.media_public_id || null,
    mediaResourceType: row.media_resource_type || 'image',
    mediaDuration: row.media_duration ? Number(row.media_duration) : null,
    mediaSize: row.media_size ? Number(row.media_size) : null,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
};

export const verifyConversationParticipant = async (conversationId, userId) => {
  const { data: participant, error } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('employee_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Error verifying conversation participant', { conversationId, userId, error: error.message });
  }

  return Boolean(participant);
};

export const getOrCreateDirectConversation = async (senderId, recipientId) => {
  if (senderId === recipientId) {
    throw new AppError('Cannot start a chat conversation with yourself', 400);
  }

  // Check if recipient exists and is active
  const { data: recipientRow } = await supabase
    .from('employees')
    .select('*')
    .eq('id', recipientId)
    .single();

  if (!recipientRow || recipientRow.is_active === false) {
    throw new AppError('Recipient employee not found or inactive', 404);
  }

  // Find existing conversation between senderId and recipientId
  const { data: senderParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('employee_id', senderId);

  const senderConvIds = (senderParts || []).map((p) => p.conversation_id);

  if (senderConvIds.length > 0) {
    const { data: commonParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('employee_id', recipientId)
      .in('conversation_id', senderConvIds);

    const commonConvIds = (commonParts || []).map((p) => p.conversation_id);

    if (commonConvIds.length > 0) {
      const { data: directConvs } = await supabase
        .from('conversations')
        .select('*')
        .eq('type', 'DIRECT')
        .in('id', commonConvIds)
        .limit(1);

      if (directConvs && directConvs.length > 0) {
        const existingConv = directConvs[0];
        return await getConversationDetails(existingConv.id, senderId);
      }
    }
  }

  // Create new conversation
  const now = new Date().toISOString();
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ type: 'DIRECT', created_at: now, updated_at: now })
    .select('*')
    .single();

  if (convError || !newConv) {
    throw new AppError(`Failed to create conversation: ${convError?.message || 'Database error'}`, 500);
  }

  // Add participants
  const participantsData = [
    { conversation_id: newConv.id, employee_id: senderId, created_at: now },
    { conversation_id: newConv.id, employee_id: recipientId, created_at: now }
  ];

  const { error: partError } = await supabase.from('conversation_participants').insert(participantsData);

  if (partError) {
    throw new AppError(`Failed to add conversation participants: ${partError.message}`, 500);
  }

  return await getConversationDetails(newConv.id, senderId);
};

export const getConversationDetails = async (conversationId, currentUserId) => {
  const { data: convRow, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convErr || !convRow) {
    throw new AppError('Conversation not found', 404);
  }

  const { data: partRows } = await supabase
    .from('conversation_participants')
    .select('employee_id')
    .eq('conversation_id', conversationId);

  const participantIds = (partRows || []).map((p) => p.employee_id);

  const { data: empRows } = await supabase
    .from('employees')
    .select('*')
    .in('id', participantIds);

  const participants = (empRows || []).map(mapEmployeeFromDb);

  // Get last non-expired message
  const nowIso = new Date().toISOString();
  const { data: msgRows } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastMsgRow = msgRows && msgRows.length > 0 ? msgRows[0] : null;
  let lastMessage = null;

  if (lastMsgRow) {
    const senderEmp = participants.find((p) => p.id === String(lastMsgRow.sender_id));
    lastMessage = mapMessageFromDb(lastMsgRow, { [lastMsgRow.sender_id]: senderEmp });
  }

  return {
    _id: String(convRow.id),
    id: String(convRow.id),
    type: convRow.type || 'DIRECT',
    participants,
    otherParticipant: participants.find((p) => p.id !== String(currentUserId)) || null,
    lastMessage,
    createdAt: convRow.created_at,
    updatedAt: convRow.updated_at
  };
};

export const getUserConversations = async (userId) => {
  const { data: userParts, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('employee_id', userId);

  if (partError) {
    throw new AppError(`Failed to fetch user conversations: ${partError.message}`, 500);
  }

  const convIds = (userParts || []).map((p) => p.conversation_id);
  if (convIds.length === 0) return [];

  const conversations = [];
  for (const cid of convIds) {
    try {
      const details = await getConversationDetails(cid, userId);
      conversations.push(details);
    } catch {
      // Ignore stale / deleted conversations
    }
  }

  // Sort by latest message date or updated_at DESC
  conversations.sort((a, b) => {
    const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt).getTime();
    const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt).getTime();
    return timeB - timeA;
  });

  return conversations;
};

export const getConversationMessages = async (conversationId, userId, query = {}) => {
  const isParticipant = await verifyConversationParticipant(conversationId, userId);
  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403);
  }

  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 30)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const nowIso = new Date().toISOString();

  // Fetch count
  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .gt('expires_at', nowIso);

  if (countError) {
    throw new AppError(`Failed to count messages: ${countError.message}`, 500);
  }

  // Fetch paginated messages sorted DESC for correct pagination
  const { data: rows, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (msgError) {
    throw new AppError(`Failed to fetch messages: ${msgError.message}`, 500);
  }

  // Extract unique senders
  const senderIds = Array.from(new Set((rows || []).map((r) => r.sender_id)));
  let senderMap = {};

  if (senderIds.length > 0) {
    const { data: empRows } = await supabase.from('employees').select('*').in('id', senderIds);
    (empRows || []).forEach((r) => {
      senderMap[r.id] = mapEmployeeFromDb(r);
    });
  }

  // Map and reverse to ascending order for client UI timeline
  const items = (rows || []).map((r) => mapMessageFromDb(r, senderMap)).reverse();
  const total = count || items.length;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

export const sendTextMessage = async (conversationId, senderId, content) => {
  const isParticipant = await verifyConversationParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403);
  }

  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    throw new AppError('Message content cannot be empty', 400);
  }

  if (cleanContent.length > 2000) {
    throw new AppError('Message text cannot exceed 2000 characters', 400);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const insertData = {
    conversation_id: conversationId,
    sender_id: senderId,
    message_type: 'TEXT',
    content: cleanContent,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };

  const { data: newRow, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select('*')
    .single();

  if (error || !newRow) {
    throw new AppError(`Failed to send message: ${error?.message || 'Database error'}`, 500);
  }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: now.toISOString() })
    .eq('id', conversationId);

  // Fetch sender employee details
  const { data: senderRow } = await supabase.from('employees').select('*').eq('id', senderId).single();
  const senderEmp = senderRow ? mapEmployeeFromDb(senderRow) : { id: senderId };

  return mapMessageFromDb(newRow, { [senderId]: senderEmp });
};

export const sendMediaMessage = async (conversationId, senderId, file, payload = {}) => {
  const isParticipant = await verifyConversationParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403);
  }

  if (!file) {
    throw new AppError('Media file is required', 400);
  }

  const messageType = (payload.messageType || 'IMAGE').toUpperCase();
  if (messageType !== 'IMAGE' && messageType !== 'VOICE') {
    throw new AppError('Invalid message type. Only IMAGE or VOICE media is allowed', 400);
  }

  const isVoice = messageType === 'VOICE';
  let durationVal = payload.duration ? Number(payload.duration) : null;

  if (isVoice && durationVal && durationVal > 120) {
    throw new AppError('Voice note duration cannot exceed 2 minutes (120 seconds)', 400);
  }

  const uploadRes = await uploadChatMediaBuffer(file, isVoice);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const insertData = {
    conversation_id: conversationId,
    sender_id: senderId,
    message_type: messageType,
    content: payload.content ? payload.content.trim() : null,
    media_url: uploadRes.url,
    media_public_id: uploadRes.publicId,
    media_resource_type: uploadRes.resourceType || (isVoice ? 'video' : 'image'),
    media_duration: durationVal || uploadRes.duration || null,
    media_size: uploadRes.size || file.size || null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };

  const { data: newRow, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select('*')
    .single();

  if (error || !newRow) {
    throw new AppError(`Failed to save media message: ${error?.message || 'Database error'}`, 500);
  }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: now.toISOString() })
    .eq('id', conversationId);

  // Fetch sender details
  const { data: senderRow } = await supabase.from('employees').select('*').eq('id', senderId).single();
  const senderEmp = senderRow ? mapEmployeeFromDb(senderRow) : { id: senderId };

  return mapMessageFromDb(newRow, { [senderId]: senderEmp });
};

export const cleanupExpiredMessages = async () => {
  const nowIso = new Date().toISOString();
  logger.info('Starting 24-hour expired messages cleanup job execution');

  try {
    const { data: expiredRows, error } = await supabase
      .from('messages')
      .select('*')
      .lte('expires_at', nowIso);

    if (error) {
      logger.error('Error fetching expired messages for cleanup', { error: error.message });
      return { cleanedCount: 0, error: error.message };
    }

    const expiredList = expiredRows || [];
    logger.info(`Found ${expiredList.length} expired chat messages to clean up`);

    let cleanedCount = 0;
    for (const msg of expiredList) {
      if (msg.media_public_id) {
        try {
          await deleteChatMedia(msg.media_public_id, msg.media_resource_type || 'image');
        } catch (mediaErr) {
          logger.warn('Non-fatal error deleting Cloudinary chat asset during cleanup', {
            mediaPublicId: msg.media_public_id,
            error: mediaErr.message
          });
        }
      }

      const { error: delError } = await supabase.from('messages').delete().eq('id', msg.id);

      if (!delError) {
        cleanedCount++;
      } else {
        logger.error('Failed to delete expired message row from DB', { id: msg.id, error: delError.message });
      }
    }

    logger.info('Expired chat messages cleanup completed successfully', { cleanedCount });
    return { cleanedCount, timestamp: nowIso };
  } catch (err) {
    logger.error('Error during expired messages cleanup execution', { error: err.message });
    return { cleanedCount: 0, error: err.message };
  }
};
