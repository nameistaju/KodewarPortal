import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { mapEmployeeFromDb } from '../utils/supabaseHelpers.js';
import { uploadChatMediaBuffer, deleteChatMedia } from './uploadService.js';

const DEFAULT_CHANNELS = [
  { name: 'General', description: 'Company-wide announcements and team chatter', type: 'CHANNEL', channel_type: 'PUBLIC', is_private: false, slug: 'general' },
  { name: 'Development', description: 'Engineering, tech stack and coding discussions', type: 'CHANNEL', channel_type: 'PUBLIC', is_private: false, slug: 'development' },
  { name: 'Design', description: 'UI/UX, graphic design and brand assets', type: 'CHANNEL', channel_type: 'PUBLIC', is_private: false, slug: 'design' },
  { name: 'SEO & Marketing', description: 'Marketing campaigns, analytics and growth', type: 'CHANNEL', channel_type: 'PUBLIC', is_private: false, slug: 'marketing' },
  { name: 'Content', description: 'Copywriting, documentation and social posts', type: 'CHANNEL', channel_type: 'PUBLIC', is_private: false, slug: 'content' },
  { name: 'HR', description: 'Human Resources, confidential policies and employee support', type: 'CHANNEL', channel_type: 'PRIVATE', is_private: true, slug: 'hr' }
];

export const ensureDefaultChannelsExist = async () => {
  try {
    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('*')
      .eq('type', 'CHANNEL');

    const existingSlugs = new Set((existingConvs || []).map((c) => c.slug || c.name?.toLowerCase()));

    const { data: hrAdminEmps } = await supabase
      .from('employees')
      .select('id, role, department')
      .eq('is_active', true);

    const hrAdminIds = (hrAdminEmps || [])
      .filter((e) => e.role === 'ADMIN' || (e.department && e.department.toUpperCase() === 'HR'))
      .map((e) => e.id);

    const now = new Date().toISOString();

    for (const def of DEFAULT_CHANNELS) {
      if (!existingSlugs.has(def.slug) && !existingSlugs.has(def.name.toLowerCase())) {
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            name: def.name,
            description: def.description,
            type: def.type,
            channel_type: def.channel_type,
            is_private: def.is_private,
            slug: def.slug,
            created_at: now,
            updated_at: now
          })
          .select('*')
          .single();

        if (!error && created) {
          logger.info(`Created default channel: ${def.name}`, { id: created.id });

          if (def.is_private && hrAdminIds.length > 0) {
            const partRows = hrAdminIds.map((empId) => ({
              conversation_id: created.id,
              employee_id: empId,
              role: 'ADMIN',
              created_at: now
            }));
            await supabase.from('conversation_participants').insert(partRows);
          }
        }
      }
    }
  } catch (err) {
    logger.warn('Non-fatal warning in ensureDefaultChannelsExist', { error: err.message });
  }
};

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

export const canUserAccessConversation = async (conversationId, userId, userRole = 'EMPLOYEE') => {
  const { data: convRow, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error || !convRow) return false;

  if (userRole === 'ADMIN') return true;

  const isPublicChannel = convRow.type === 'CHANNEL' && (convRow.is_private === false || convRow.channel_type === 'PUBLIC');
  if (isPublicChannel) return true;

  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('employee_id', userId)
    .maybeSingle();

  return Boolean(participant);
};

export const verifyConversationParticipant = async (conversationId, userId) => {
  const { data: userRow } = await supabase.from('employees').select('role').eq('id', userId).maybeSingle();
  const userRole = userRow?.role?.toUpperCase() || 'EMPLOYEE';
  return await canUserAccessConversation(conversationId, userId, userRole);
};

export const getOrCreateDirectConversation = async (senderId, recipientId) => {
  if (senderId === recipientId) {
    throw new AppError('Cannot start a chat conversation with yourself', 400);
  }

  const { data: recipientRow } = await supabase
    .from('employees')
    .select('*')
    .eq('id', recipientId)
    .single();

  if (!recipientRow || recipientRow.is_active === false) {
    throw new AppError('Recipient employee not found or inactive', 404);
  }

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

  const now = new Date().toISOString();
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ type: 'DIRECT', created_at: now, updated_at: now })
    .select('*')
    .single();

  if (convError || !newConv) {
    throw new AppError(`Failed to create conversation: ${convError?.message || 'Database error'}`, 500);
  }

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

export const createChannel = async (creatorUser, payload) => {
  const { name, description, type = 'CHANNEL', isPrivate = false, participantIds = [] } = payload;
  const isChannel = type === 'CHANNEL';

  if (isChannel && creatorUser.role !== 'ADMIN' && creatorUser.department?.toUpperCase() !== 'HR') {
    throw new AppError('Only administrators or HR personnel can create channels', 403);
  }

  const now = new Date().toISOString();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      name,
      description: description || null,
      type: isChannel ? 'CHANNEL' : 'GROUP',
      is_private: Boolean(isPrivate),
      channel_type: isPrivate ? 'PRIVATE' : 'PUBLIC',
      slug,
      owner_id: creatorUser.id || creatorUser._id,
      created_at: now,
      updated_at: now
    })
    .select('*')
    .single();

  if (error || !newConv) {
    throw new AppError(`Failed to create ${type.toLowerCase()}: ${error?.message || 'Database error'}`, 500);
  }

  const creatorId = creatorUser.id || creatorUser._id;
  const allParticipantIds = Array.from(new Set([String(creatorId), ...(participantIds || [])]));

  const partRows = allParticipantIds.map((empId) => ({
    conversation_id: newConv.id,
    employee_id: empId,
    role: String(empId) === String(creatorId) ? 'OWNER' : 'MEMBER',
    created_at: now
  }));

  await supabase.from('conversation_participants').insert(partRows);

  return await getConversationDetails(newConv.id, creatorId);
};

export const addChannelMember = async (requestUser, conversationId, targetEmployeeId, role = 'MEMBER') => {
  const canAccess = await canUserAccessConversation(conversationId, requestUser.id || requestUser._id, requestUser.role);
  if (!canAccess) {
    throw new AppError('You do not have permission to modify this channel/group', 403);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('conversation_participants')
    .upsert({
      conversation_id: conversationId,
      employee_id: targetEmployeeId,
      role,
      created_at: now
    }, { onConflict: 'conversation_id,employee_id' });

  if (error) {
    throw new AppError(`Failed to add member: ${error.message}`, 500);
  }

  return await getConversationDetails(conversationId, requestUser.id || requestUser._id);
};

export const removeChannelMember = async (requestUser, conversationId, targetEmployeeId) => {
  const canAccess = await canUserAccessConversation(conversationId, requestUser.id || requestUser._id, requestUser.role);
  if (!canAccess) {
    throw new AppError('You do not have permission to modify this channel/group', 403);
  }

  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('employee_id', targetEmployeeId);

  if (error) {
    throw new AppError(`Failed to remove member: ${error.message}`, 500);
  }

  return { success: true, conversationId, removedEmployeeId: targetEmployeeId };
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
    .select('employee_id, role')
    .eq('conversation_id', conversationId);

  const participantIds = (partRows || []).map((p) => p.employee_id);

  const { data: empRows } = await supabase
    .from('employees')
    .select('*')
    .in('id', participantIds);

  const participants = (empRows || []).map(mapEmployeeFromDb);

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
    name: convRow.name || null,
    description: convRow.description || null,
    isPrivate: Boolean(convRow.is_private),
    channelType: convRow.channel_type || (convRow.is_private ? 'PRIVATE' : 'PUBLIC'),
    slug: convRow.slug || null,
    ownerId: convRow.owner_id ? String(convRow.owner_id) : null,
    participants,
    otherParticipant: convRow.type === 'DIRECT' ? (participants.find((p) => p.id !== String(currentUserId)) || null) : null,
    lastMessage,
    createdAt: convRow.created_at,
    updatedAt: convRow.updated_at
  };
};

export const getUserConversations = async (userId) => {
  await ensureDefaultChannelsExist();

  const { data: userRow } = await supabase.from('employees').select('role, department').eq('id', userId).maybeSingle();
  const userRole = userRow?.role?.toUpperCase() || 'EMPLOYEE';
  const userDept = userRow?.department?.toUpperCase() || '';

  const { data: userParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('employee_id', userId);

  const participantConvIds = (userParts || []).map((p) => p.conversation_id);

  const { data: publicChannels } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'CHANNEL')
    .or('is_private.eq.false,channel_type.eq.PUBLIC');

  const publicChannelIds = (publicChannels || []).map((c) => c.id);

  const allAccessibleIds = Array.from(new Set([...participantConvIds, ...publicChannelIds]));
  if (allAccessibleIds.length === 0) return [];

  const conversations = [];
  for (const cid of allAccessibleIds) {
    try {
      const details = await getConversationDetails(cid, userId);

      if (details.type === 'CHANNEL' && details.isPrivate) {
        const isMember = details.participants.some((p) => String(p.id) === String(userId));
        const isAdmin = userRole === 'ADMIN';
        const isHrMember = userDept === 'HR' && details.slug === 'hr';
        if (!isMember && !isAdmin && !isHrMember) {
          continue;
        }
      }

      conversations.push(details);
    } catch {
      // Ignore stale / deleted conversations
    }
  }

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
    throw new AppError('You are not authorized to view messages in this conversation/channel', 403);
  }

  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 30)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const nowIso = new Date().toISOString();

  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .gt('expires_at', nowIso);

  if (countError) {
    throw new AppError(`Failed to count messages: ${countError.message}`, 500);
  }

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

  const senderIds = Array.from(new Set((rows || []).map((r) => r.sender_id)));
  let senderMap = {};

  if (senderIds.length > 0) {
    const { data: empRows } = await supabase.from('employees').select('*').in('id', senderIds);
    (empRows || []).forEach((r) => {
      senderMap[r.id] = mapEmployeeFromDb(r);
    });
  }

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
    throw new AppError('You are not authorized to send messages to this conversation/channel', 403);
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

  await supabase
    .from('conversations')
    .update({ updated_at: now.toISOString() })
    .eq('id', conversationId);

  const { data: senderRow } = await supabase.from('employees').select('*').eq('id', senderId).single();
  const senderEmp = senderRow ? mapEmployeeFromDb(senderRow) : { id: senderId };

  return mapMessageFromDb(newRow, { [senderId]: senderEmp });
};

export const sendMediaMessage = async (conversationId, senderId, file, payload = {}) => {
  const isParticipant = await verifyConversationParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw new AppError('You are not authorized to send media to this conversation/channel', 403);
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

  await supabase
    .from('conversations')
    .update({ updated_at: now.toISOString() })
    .eq('id', conversationId);

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
