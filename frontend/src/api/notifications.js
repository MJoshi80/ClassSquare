import api from './client';

export const notificationsApi = {
  getNotifications: (unreadOnly = false, limit = 50) =>
    api.get('/notifications', { params: { unread_only: unreadOnly, limit } }),

  getUnreadCount: () => api.get('/notifications/unread-count'),

  markRead: (id) => api.post(`/notifications/${id}/read`),

  markAllRead: () => api.post('/notifications/read-all'),
};
