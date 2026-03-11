import jwt from 'jsonwebtoken';

const onlineUsers = new Map(); // userId -> socketId

export function setupSocket(io) {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Não autenticado'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', socket => {
    const uid = socket.user.id;
    onlineUsers.set(uid, socket.id);
    socket.broadcast.emit('user_online', { userId: uid });

    /* ── Join conversation room ── */
    socket.on('join_conversation', ({ conversationId }) => {
      socket.join(`conv:${conversationId}`);
    });

    /* ── Leave conversation room ── */
    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conv:${conversationId}`);
    });

    /* ── Send message (real-time broadcast) ── */
    socket.on('send_message', ({ conversationId, content, mediaUrl, mediaType = 'text' }) => {
      const message = {
        id:        `rt-${Date.now()}`,
        content,
        mediaUrl,
        mediaType,
        time:      new Date().toISOString(),
        author:    { id: uid, displayName: socket.user.displayName },
      };
      io.to(`conv:${conversationId}`).emit('new_message', { conversationId, message });
    });

    /* ── Typing indicator ── */
    socket.on('typing', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('user_typing', { userId: uid, conversationId });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('user_stop_typing', { userId: uid, conversationId });
    });

    /* ── Mark as read ── */
    socket.on('mark_read', ({ conversationId, messageId }) => {
      socket.to(`conv:${conversationId}`).emit('message_read', { userId: uid, messageId });
    });

    /* ── Disconnect ── */
    socket.on('disconnect', () => {
      onlineUsers.delete(uid);
      socket.broadcast.emit('user_offline', { userId: uid });
    });
  });
}

export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}
