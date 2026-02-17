'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  UserPlus,
  Calendar,
  Clock,
  Megaphone,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
} from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { Notification, NotificationType } from '@/lib/definitions';
import {
  getNotifications,
  markNotificationAsRead,
  dismissNotification,
  markAllNotificationsAsRead,
} from '@/lib/notifications';

interface PDLNotificationCenterProps {
  tournamentId: string;
  recipientId: string; // teamId or userId
  recipientType?: 'team' | 'captain' | 'player';
  onActionClick?: (notification: Notification) => void;
}

export function PDLNotificationCenter({
  tournamentId,
  recipientId,
  recipientType = 'captain',
  onActionClick,
}: PDLNotificationCenterProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, [tournamentId, recipientId, recipientType]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications({
        tournamentId,
        recipientId,
        recipientType,
      });
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(tournamentId, id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissNotification(tournamentId, id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead(tournamentId, recipientId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
  const urgentCount = notifications.filter(
    n => (n.priority === 'critical' || n.priority === 'high') && !n.read && !n.dismissed
  ).length;

  const filteredNotifications = notifications
    .filter(n => !n.dismissed)
    .filter(n => {
      if (filter === 'unread') return !n.read;
      if (filter === 'urgent') return n.priority === 'critical' || n.priority === 'high';
      return true;
    });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'standin_approval_required':
      case 'standin_request_approved':
      case 'standin_request_denied':
        return UserPlus;
      case 'reschedule_approval_required':
      case 'reschedule_request_approved':
      case 'reschedule_request_denied':
        return Calendar;
      case 'match_reminder_24h':
        return Clock;
      case 'admin_announcement':
      case 'admin_message':
        return Megaphone;
      case 'transfer_window_opened':
      case 'transfer_window_closing':
        return ArrowRightLeft;
      case 'promotion_relegation_match':
        return AlertTriangle;
      default:
        return Bell;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return 'text-pdl-crimson';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-pdl-gold';
      case 'low':
        return 'text-white/60';
      default:
        return 'text-white/40';
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-lg bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-pdl-gold animate-pulse" />
          <p className="text-sm text-white/60 font-logik">Ładowanie powiadomień...</p>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 group"
        >
          <div className="relative">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              <Bell className="w-5 h-5 text-pdl-gold" />
            </div>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-pdl-crimson border-2 border-black flex items-center justify-center">
                <span className="text-[10px] font-logik-extended-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
          </div>
          <div className="text-left">
            <h3 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
              {t('notifications.title')}
            </h3>
            {(unreadCount > 0 || urgentCount > 0) && (
              <p className="text-xs text-white/40 font-logik">
                {urgentCount > 0 && (
                  <span className="text-pdl-crimson">
                    {`${urgentCount} ${urgentCount === 1 ? 'pilne' : 'pilnych'}`}
                  </span>
                )}
                {urgentCount > 0 && unreadCount > urgentCount && ' • '}
                {unreadCount > urgentCount && (
                  <span className="text-white/60">
                    {`${unreadCount - urgentCount} ${(unreadCount - urgentCount) === 1 ? 'nieprzeczytane' : 'nieprzeczytanych'}`}
                  </span>
                )}
              </p>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-white/40 ml-auto" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/40 ml-auto" />
          )}
        </button>

        {expanded && unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMarkAllRead}
            className="text-xs text-white/60 hover:text-white"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {expanded && (
        <>
          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-logik-extended-bold transition-colors',
                filter === 'all'
                  ? 'bg-pdl-gold text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              {t('notifications.filters.all')}
              {notifications.filter(n => !n.dismissed).length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                  {notifications.filter(n => !n.dismissed).length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-logik-extended-bold transition-colors',
                filter === 'unread'
                  ? 'bg-pdl-gold text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              {t('notifications.filters.unread')}
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-pdl-crimson text-white">
                  {unreadCount}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-logik-extended-bold transition-colors',
                filter === 'urgent'
                  ? 'bg-pdl-gold text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              {t('notifications.filters.urgent')}
              {urgentCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-pdl-crimson text-white">
                  {urgentCount}
                </Badge>
              )}
            </button>
          </div>

          {/* Notifications List */}
          <div className="space-y-2">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 rounded-lg bg-white/[0.02] border border-white/10 text-center">
                <p className="text-sm text-white/40 font-logik">
                  {filter === 'unread' && t('notifications.emptyUnread')}
                  {filter === 'urgent' && t('notifications.emptyUrgent')}
                  {filter === 'all' && t('notifications.empty')}
                </p>
              </div>
            ) : (
              filteredNotifications.map(notification => {
                const Icon = getIcon(notification.type);
                const isUrgent = notification.priority === 'critical' || notification.priority === 'high';

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 rounded-lg border transition-all',
                      !notification.read
                        ? 'bg-white/[0.05] border-pdl-gold/30'
                        : 'bg-white/[0.02] border-white/10',
                      isUrgent && !notification.read && 'border-pdl-crimson/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg border shrink-0',
                          isUrgent
                            ? 'bg-pdl-crimson/20 border-pdl-crimson/50'
                            : 'bg-white/5 border-white/10'
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4',
                            isUrgent ? 'text-pdl-crimson' : getPriorityColor(notification.priority)
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-logik-extended-bold text-white">
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-pdl-gold shrink-0" />
                              )}
                              {isUrgent && (
                                <Badge
                                  variant="destructive"
                                  className="bg-pdl-crimson text-white text-[10px] px-1.5 py-0"
                                >
                                  {t('notifications.filters.urgent').toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-white/70 font-logik">
                              {notification.message}
                            </p>
                            <p className="text-xs text-white/40 font-logik mt-1">
                              {formatDatePL(notification.createdAt)}
                            </p>
                          </div>

                          <button
                            onClick={() => handleDismiss(notification.id)}
                            className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                          >
                            <X className="w-4 h-4 text-white/40" />
                          </button>
                        </div>

                        {notification.actionable && !notification.actionTaken && (
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (onActionClick) onActionClick(notification);
                                handleMarkAsRead(notification.id);
                              }}
                              className="text-xs font-logik-extended-bold bg-pdl-crimson hover:bg-pdl-crimson/80"
                            >
                              {t('notifications.actions.viewMatch')}
                            </Button>
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-xs font-logik border-white/20 text-white/70 hover:bg-white/10"
                              >
                                {t('notifications.markAsRead')}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
