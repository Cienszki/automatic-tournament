// src/lib/notifications.ts
/**
 * Notification Service
 * Handles CRUD operations for the notification system
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationRecipientType,
  NotificationMetadata,
} from './definitions';

// ============================================
// CREATE NOTIFICATIONS
// ============================================

interface CreateNotificationParams {
  tournamentId: string;
  type: NotificationType;
  priority: NotificationPriority;
  recipientType: NotificationRecipientType;
  recipientId: string;
  title: string;
  message: string;
  metadata: NotificationMetadata;
  actionable?: boolean;
  expiresAt?: Date;
}

/**
 * Create a new notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const notificationsRef = collection(db, `tournaments/${params.tournamentId}/notifications`);
  
  const notification = {
    type: params.type,
    priority: params.priority,
    recipientType: params.recipientType,
    recipientId: params.recipientId,
    title: params.title,
    message: params.message,
    metadata: params.metadata,
    createdAt: serverTimestamp(),
    expiresAt: params.expiresAt ? Timestamp.fromDate(params.expiresAt) : null,
    read: false,
    dismissed: false,
    actionable: params.actionable ?? true,
    actionTaken: false,
  };

  const docRef = await addDoc(notificationsRef, notification);
  return docRef.id;
}

/**
 * Create multiple notifications at once
 */
export async function createNotifications(
  notifications: CreateNotificationParams[]
): Promise<string[]> {
  const ids = await Promise.all(notifications.map(createNotification));
  return ids;
}

// ============================================
// READ NOTIFICATIONS
// ============================================

interface GetNotificationsParams {
  tournamentId: string;
  recipientId: string;
  recipientType?: NotificationRecipientType;
  unreadOnly?: boolean;
  actionableOnly?: boolean;
  priority?: NotificationPriority;
  type?: NotificationType;
}

/**
 * Get notifications for a specific recipient
 */
export async function getNotifications(
  params: GetNotificationsParams
): Promise<Notification[]> {
  const notificationsRef = collection(db, `tournaments/${params.tournamentId}/notifications`);
  
  const constraints: QueryConstraint[] = [
    where('recipientId', '==', params.recipientId),
  ];

  if (params.recipientType) {
    constraints.push(where('recipientType', '==', params.recipientType));
  }

  if (params.unreadOnly) {
    constraints.push(where('read', '==', false));
  }

  if (params.actionableOnly) {
    constraints.push(where('actionable', '==', true));
    constraints.push(where('actionTaken', '==', false));
  }

  if (params.priority) {
    constraints.push(where('priority', '==', params.priority));
  }

  if (params.type) {
    constraints.push(where('type', '==', params.type));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(notificationsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    tournamentId: params.tournamentId,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString(),
    actionTakenAt: doc.data().actionTakenAt?.toDate?.()?.toISOString(),
  })) as Notification[];
}

/**
 * Get a single notification by ID
 */
export async function getNotification(
  tournamentId: string,
  notificationId: string
): Promise<Notification | null> {
  const docRef = doc(db, `tournaments/${tournamentId}/notifications`, notificationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    tournamentId,
    ...snapshot.data(),
    createdAt: snapshot.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    expiresAt: snapshot.data().expiresAt?.toDate?.()?.toISOString(),
    actionTakenAt: snapshot.data().actionTakenAt?.toDate?.()?.toISOString(),
  } as Notification;
}

// ============================================
// UPDATE NOTIFICATIONS
// ============================================

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  tournamentId: string,
  notificationId: string
): Promise<void> {
  const docRef = doc(db, `tournaments/${tournamentId}/notifications`, notificationId);
  await updateDoc(docRef, {
    read: true,
  });
}

/**
 * Mark multiple notifications as read
 */
export async function markNotificationsAsRead(
  tournamentId: string,
  notificationIds: string[]
): Promise<void> {
  await Promise.all(
    notificationIds.map(id => markNotificationAsRead(tournamentId, id))
  );
}

/**
 * Mark all notifications as read for a recipient
 */
export async function markAllNotificationsAsRead(
  tournamentId: string,
  recipientId: string
): Promise<void> {
  const notifications = await getNotifications({
    tournamentId,
    recipientId,
    unreadOnly: true,
  });

  await markNotificationsAsRead(
    tournamentId,
    notifications.map(n => n.id)
  );
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(
  tournamentId: string,
  notificationId: string
): Promise<void> {
  const docRef = doc(db, `tournaments/${tournamentId}/notifications`, notificationId);
  await updateDoc(docRef, {
    dismissed: true,
  });
}

/**
 * Mark an action as taken
 */
export async function markActionTaken(
  tournamentId: string,
  notificationId: string
): Promise<void> {
  const docRef = doc(db, `tournaments/${tournamentId}/notifications`, notificationId);
  await updateDoc(docRef, {
    actionTaken: true,
    actionTakenAt: serverTimestamp(),
  });
}

// ============================================
// DELETE NOTIFICATIONS
// ============================================

/**
 * Delete a notification
 */
export async function deleteNotification(
  tournamentId: string,
  notificationId: string
): Promise<void> {
  const docRef = doc(db, `tournaments/${tournamentId}/notifications`, notificationId);
  await deleteDoc(docRef);
}

/**
 * Delete expired notifications
 */
export async function deleteExpiredNotifications(tournamentId: string): Promise<number> {
  const notificationsRef = collection(db, `tournaments/${tournamentId}/notifications`);
  const now = Timestamp.now();
  
  const q = query(
    notificationsRef,
    where('expiresAt', '<=', now)
  );

  const snapshot = await getDocs(q);
  
  await Promise.all(
    snapshot.docs.map(doc => deleteDoc(doc.ref))
  );

  return snapshot.size;
}

// ============================================
// NOTIFICATION CREATORS (SPECIFIC TYPES)
// ============================================

/**
 * Create standin approval notification
 */
export async function createStandinApprovalNotification(
  tournamentId: string,
  recipientTeamId: string,
  requestId: string,
  matchId: string,
  requestingTeamName: string,
  standinName: string
): Promise<string> {
  return createNotification({
    tournamentId,
    type: 'standin_approval_required',
    priority: 'critical',
    recipientType: 'captain',
    recipientId: recipientTeamId,
    title: 'Wniosek o standina wymaga zatwierdzenia',
    message: `${requestingTeamName} prosi o zatwierdzenie standina: ${standinName}`,
    metadata: {
      requestId,
      matchId,
      opponentTeamName: requestingTeamName,
      standinName,
    },
    actionable: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });
}

/**
 * Create reschedule approval notification
 */
export async function createRescheduleApprovalNotification(
  tournamentId: string,
  recipientTeamId: string,
  matchId: string,
  requestingTeamName: string,
  originalDate: string,
  proposedDate: string
): Promise<string> {
  return createNotification({
    tournamentId,
    type: 'reschedule_approval_required',
    priority: 'critical',
    recipientType: 'captain',
    recipientId: recipientTeamId,
    title: 'Prośba o zmianę terminu meczu',
    message: `${requestingTeamName} prosi o przełożenie meczu`,
    metadata: {
      matchId,
      opponentTeamName: requestingTeamName,
      originalDate,
      proposedDate,
    },
    actionable: true,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
  });
}

/**
 * Create match reminder notification (24h)
 */
export async function createMatchReminder24h(
  tournamentId: string,
  teamId: string,
  matchId: string,
  opponentName: string,
  matchTime: string
): Promise<string> {
  return createNotification({
    tournamentId,
    type: 'match_reminder_24h',
    priority: 'high',
    recipientType: 'team',
    recipientId: teamId,
    title: 'Mecz za 24 godziny',
    message: `Twój mecz przeciwko ${opponentName} odbędzie się jutro`,
    metadata: {
      matchId,
      opponentName,
      matchTime,
    },
    actionable: false,
    expiresAt: new Date(matchTime),
  });
}

/**
 * Create transfer window opened notification
 */
export async function createTransferWindowOpenedNotification(
  tournamentId: string,
  teamId: string,
  windowCloses: string,
  maxTransfers: number
): Promise<string> {
  return createNotification({
    tournamentId,
    type: 'transfer_window_opened',
    priority: 'high',
    recipientType: 'captain',
    recipientId: teamId,
    title: 'Okno transferowe otwarte',
    message: `Możesz dokonać zmian w składzie drużyny`,
    metadata: {
      windowCloses,
      maxTransfers,
    },
    actionable: false,
  });
}

/**
 * Create standin request status notification (approved/denied)
 */
export async function createStandinRequestStatusNotification(
  tournamentId: string,
  requestingTeamId: string,
  matchId: string,
  standinName: string,
  approved: boolean,
  denialReason?: string
): Promise<string> {
  return createNotification({
    tournamentId,
    type: approved ? 'standin_request_approved' : 'standin_request_denied',
    priority: 'medium',
    recipientType: 'captain',
    recipientId: requestingTeamId,
    title: approved ? 'Wniosek o standina zatwierdzony' : 'Wniosek o standina odrzucony',
    message: approved
      ? `Przeciwnik zatwierdził standina: ${standinName}`
      : `Przeciwnik odrzucił standina: ${standinName}`,
    metadata: {
      matchId,
      standinName,
      denialReason,
    },
    actionable: false,
  });
}

/**
 * Create reschedule request status notification (approved/denied)
 */
export async function createRescheduleRequestStatusNotification(
  tournamentId: string,
  requestingTeamId: string,
  matchId: string,
  approved: boolean,
  newDate?: string,
  denialReason?: string,
  approvedBy?: 'opponent' | 'admin'
): Promise<string> {
  return createNotification({
    tournamentId,
    type: approved ? 'reschedule_request_approved' : 'reschedule_request_denied',
    priority: 'medium',
    recipientType: 'captain',
    recipientId: requestingTeamId,
    title: approved ? 'Zmiana terminu zatwierdzona' : 'Zmiana terminu odrzucona',
    message: approved
      ? `Twoja prośba o zmianę terminu została zaakceptowana`
      : `Twoja prośba o zmianę terminu została odrzucona`,
    metadata: {
      matchId,
      newDate,
      denialReason,
      approvedBy,
      deniedBy: !approved ? (approvedBy || 'opponent') : undefined,
    },
    actionable: false,
  });
}

/**
 * Create promotion/relegation match notification
 */
export async function createPromotionRelegationMatchNotification(
  tournamentId: string,
  teamId: string,
  matchId: string,
  matchType: 'promotion' | 'relegation',
  opponentName: string,
  divisionMovement: string
): Promise<string> {
  return createNotification({
    tournamentId,
    type: 'promotion_relegation_match',
    priority: 'high',
    recipientType: 'team',
    recipientId: teamId,
    title: matchType === 'promotion' ? 'Mecz o awans' : 'Mecz o utrzymanie',
    message: `Zaplanowano mecz barażowy przeciwko ${opponentName}`,
    metadata: {
      matchId,
      matchType,
      opponentName,
      divisionMovement,
    },
    actionable: false,
  });
}
