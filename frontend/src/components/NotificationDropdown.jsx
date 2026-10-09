import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import {
  CalendarIcon,
  UserCheckIcon,
  CheckCircleIcon,
  BookIcon,
  InfoIcon,
  ClipboardListIcon,
  FolderIcon,
  MegaphoneIcon,
  SparkleIcon,
  AlertTriangleIcon,
  LightningIcon,
  CloseIcon,
} from './Icons';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const isOpen = Boolean(anchorEl);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.unread_count);
    } catch (err) {
      // Ignore background fetch error
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications(false, 20);
      setNotifications(res.data);
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000); // 20s polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeConfig = (type) => {
    switch (type) {
      case 'timetable_published':
        return {
          icon: <CalendarIcon className="w-4 h-4 text-blue-600" />,
          bg: '#eff6ff',
          border: '#bfdbfe',
        };
      case 'timetable_rejected':
        return {
          icon: <AlertTriangleIcon className="w-4 h-4 text-red-600" />,
          bg: '#fef2f2',
          border: '#fecaca',
        };
      case 'substitution_assigned':
        return {
          icon: <UserCheckIcon className="w-4 h-4 text-emerald-600" />,
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'leave_status':
        return {
          icon: <CheckCircleIcon className="w-4 h-4 text-emerald-600" />,
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'leave_applied':
        return {
          icon: <BookIcon className="w-4 h-4 text-amber-600" />,
          bg: '#fffbeb',
          border: '#fde68a',
        };
      case 'classroom_assignment':
        return {
          icon: <ClipboardListIcon className="w-4 h-4 text-purple-600" />,
          bg: '#faf5ff',
          border: '#e9d5ff',
        };
      case 'classroom_material':
        return {
          icon: <FolderIcon className="w-4 h-4 text-sky-600" />,
          bg: '#f0f9ff',
          border: '#bae6fd',
        };
      case 'classroom':
        return {
          icon: <MegaphoneIcon className="w-4 h-4 text-purple-600" />,
          bg: '#faf5ff',
          border: '#e9d5ff',
        };
      case 'submission_received':
        return {
          icon: <ClipboardListIcon className="w-4 h-4 text-emerald-600" />,
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'submission_receipt':
        return {
          icon: <CheckCircleIcon className="w-4 h-4 text-emerald-600" />,
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'study_gap':
        return {
          icon: <SparkleIcon className="w-4 h-4 text-amber-600" />,
          bg: '#fffbeb',
          border: '#fde68a',
        };
      case 'system':
        return {
          icon: <LightningIcon className="w-4 h-4 text-purple-600" />,
          bg: '#faf5ff',
          border: '#e9d5ff',
        };
      default:
        return {
          icon: <InfoIcon className="w-4 h-4 text-slate-600" />,
          bg: '#f1f5f9',
          border: '#e2e8f0',
        };
    }
  };

  const resolveNotificationTarget = (n) => {
    if (!n) return null;
    const baseLink = n.link || '';
    const type = n.type || '';

    if (baseLink.includes('/hod')) {
      if (type.includes('leave')) return '/hod?tab=leaves';
      return '/hod?tab=studio';
    }
    if (baseLink.includes('/student')) {
      if (type.includes('voting')) return '/student?tab=voting';
      if (type.includes('classroom') || type.includes('submission')) return '/student?tab=classroom';
      return '/student?tab=timetable';
    }
    if (baseLink.includes('/faculty')) {
      if (type.includes('classroom') || type.includes('submission')) return '/faculty?tab=classroom';
      return '/faculty?tab=schedule';
    }
    if (baseLink.includes('/admin')) {
      return '/admin';
    }

    return baseLink || null;
  };

  const getActionLabel = (n) => {
    if (!n) return 'Open View';
    const type = n.type || '';
    if (type.includes('leave')) return 'View Leaves';
    if (type.includes('voting')) return 'Go to Student Voting';
    if (type.includes('classroom') || type.includes('submission')) return 'Open Classroom';
    if (type.includes('timetable')) return 'View Timetable';
    if (type === 'system') return 'Open Admin Console';
    return 'Open Linked Section';
  };

  const getCategoryLabel = (type) => {
    switch (type) {
      case 'timetable_published':
        return 'Timetable Published';
      case 'timetable_rejected':
        return 'Timetable Notice';
      case 'substitution_assigned':
        return 'Faculty Substitution';
      case 'leave_status':
        return 'Leave Status';
      case 'leave_applied':
        return 'Leave Application';
      case 'classroom_assignment':
        return 'Classroom Assignment';
      case 'classroom_material':
        return 'Classroom Material';
      case 'classroom':
        return 'Classroom Activity';
      case 'submission_received':
        return 'Student Submission';
      case 'submission_receipt':
        return 'Submission Receipt';
      case 'voting':
        return 'Timetable Voting';
      case 'study_gap':
        return 'Study Optimization';
      case 'system':
        return 'System Notification';
      default:
        return 'System Notification';
    }
  };

  const handleOpenDetailModal = async (n, e) => {
    if (e) e.stopPropagation();
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        // continue
      }
    }
    setAnchorEl(null);
    setSelectedNotification({ ...n, is_read: true });
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedNotification(null);
  };

  const handleNavigateFromModal = (targetUrl) => {
    handleCloseDetailModal();
    if (!targetUrl) return;
    navigate(targetUrl);
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="medium"
        sx={{
          color: 'inherit',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
        }}
        aria-label="notifications"
      >
        <Badge
          badgeContent={unreadCount > 9 ? '9+' : unreadCount}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              height: 18,
              minWidth: 18,
              fontWeight: 800,
              bgcolor: '#ef4444',
              color: '#fff',
            },
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </Badge>
      </IconButton>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1.5,
            width: { xs: 320, sm: 380 },
            maxHeight: 480,
            borderRadius: '16px',
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px -8px rgba(16, 42, 107, 0.15)',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.9rem' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{
                  bgcolor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  height: 20,
                }}
              />
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllRead}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.72rem',
                color: '#1d61f2',
                p: 0,
                minWidth: 'auto',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={24} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Loading alerts...</Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic', fontSize: '0.8rem' }}>
              No notifications yet
            </Box>
          ) : (
            notifications.map((n) => {
              const config = getTypeConfig(n.type);
              return (
                <Box
                  key={n.id}
                  onClick={(e) => handleOpenDetailModal(n, e)}
                  sx={{
                    p: 2,
                    display: 'flex',
                    gap: 1.5,
                    cursor: 'pointer',
                    bgcolor: n.is_read ? '#ffffff' : '#eff6ff',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s',
                    '&:hover': {
                      bgcolor: n.is_read ? '#f8fafc' : '#dbeafe',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: config.bg,
                      border: `1px solid ${config.border}`,
                    }}
                  >
                    {config.icon}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: n.is_read ? 600 : 800,
                          color: 'text.primary',
                          fontSize: '0.78rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {n.title}
                      </Typography>
                      {!n.is_read && (
                        <Box
                          component="button"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          title="Mark as read"
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#1d61f2',
                            border: 'none',
                            p: 0,
                            mt: 0.5,
                            flexShrink: 0,
                            cursor: 'pointer',
                            '&:hover': {
                              boxShadow: '0 0 0 3px rgba(29, 97, 242, 0.25)',
                            },
                          }}
                        />
                      )}
                    </Box>

                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.72rem', lineHeight: 1.4 }}>
                      {n.message}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString()}
                      </Typography>
                      {n.link && (
                        <Button
                          size="small"
                          onClick={(e) => handleOpenDetailModal(n, e)}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#1d61f2',
                            p: '2px 8px',
                            minWidth: 'auto',
                            borderRadius: '6px',
                            bgcolor: 'rgba(29, 97, 242, 0.06)',
                            '&:hover': {
                              bgcolor: 'rgba(29, 97, 242, 0.14)',
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          View details &rarr;
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Popover>

      {/* Notification Details Dialog */}
      <Dialog
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.25)',
            p: 1,
            overflow: 'hidden',
          },
        }}
      >
        {selectedNotification && (() => {
          const config = getTypeConfig(selectedNotification.type);
          const targetUrl = resolveNotificationTarget(selectedNotification);
          return (
            <>
              <DialogTitle sx={{ pb: 1, pt: 2, px: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: config.bg,
                        border: `1px solid ${config.border}`,
                      }}
                    >
                      {config.icon}
                    </Box>
                    <Chip
                      label={getCategoryLabel(selectedNotification.type)}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 22,
                        bgcolor: config.bg,
                        color: '#1e293b',
                        border: `1px solid ${config.border}`,
                      }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={handleCloseDetailModal}
                    sx={{ color: '#64748b', '&:hover': { bgcolor: '#f1f5f9' } }}
                    aria-label="close"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </IconButton>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.15rem', lineHeight: 1.3 }}>
                  {selectedNotification.title}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
                  Received on {new Date(selectedNotification.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(selectedNotification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </DialogTitle>

              <DialogContent sx={{ px: 3, py: 2 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: '14px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: '#334155',
                  }}
                >
                  {selectedNotification.message}
                </Box>

                {targetUrl && (
                  <Box
                    sx={{
                      mt: 2.5,
                      p: 1.5,
                      borderRadius: '12px',
                      bgcolor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                    <Typography sx={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                      Action Destination: <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>{targetUrl}</code>
                    </Typography>
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: 'space-between' }}>
                <Button
                  onClick={handleCloseDetailModal}
                  variant="outlined"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '10px',
                    color: '#64748b',
                    borderColor: '#cbd5e1',
                    '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                  }}
                >
                  Close
                </Button>

                {targetUrl && (
                  <Button
                    onClick={() => handleNavigateFromModal(targetUrl)}
                    variant="contained"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '10px',
                      px: 2.5,
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                      },
                    }}
                  >
                    {getActionLabel(selectedNotification)} &rarr;
                  </Button>
                )}
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </>
  );
}
