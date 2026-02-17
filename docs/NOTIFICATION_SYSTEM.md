# PDL Notification System

## Overview
The notification system provides real-time alerts to team captains and players about important tournament events requiring action or awareness.

## Notification Types (Priority Order)

### 🔴 Critical - Immediate Action Required

#### 1. Match Forfeit Warning (15 min before)
**Trigger:** Match starts in 15 minutes and team is not in lobby
**Target:** Team captain + all players
**Action Required:** Join lobby immediately or forfeit match
**Storage:** Real-time check, no persistence needed
```typescript
{
  type: 'match_forfeit_warning',
  priority: 'critical',
  matchId: string,
  timeUntilForfeit: number, // minutes
  requiresAction: true
}
```

#### 2. Opponent Standin Request Pending
**Trigger:** Opponent submits standin request
**Target:** Team captain of opposing team
**Action Required:** Approve or deny within 24h
**Storage:** Derived from `standinRequests` collection
```typescript
{
  type: 'standin_approval_required',
  priority: 'critical',
  requestId: string,
  matchId: string,
  opponentTeamName: string,
  standinName: string,
  deadline: timestamp
}
```

#### 3. Opponent Match Reschedule Request
**Trigger:** Opponent requests match reschedule
**Target:** Team captain
**Action Required:** Approve or deny within 48h
**Storage:** Derived from `match.rescheduleRequest`
```typescript
{
  type: 'reschedule_approval_required',
  priority: 'critical',
  matchId: string,
  opponentTeamName: string,
  proposedDate: timestamp,
  currentDate: timestamp,
  deadline: timestamp
}
```

#### 4. Admin Direct Message
**Trigger:** Admin sends direct message to team
**Target:** Team captain (+ optionally all players)
**Action Required:** Varies by message
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'admin_message',
  priority: 'critical',
  title: string,
  message: string,
  requiresResponse: boolean,
  deadline?: timestamp
}
```

#### 5. Time Penalty Applied
**Trigger:** Admin applies time penalty to team
**Target:** Team captain + all players
**Action Required:** Acknowledge and prepare for next match
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'time_penalty_applied',
  priority: 'critical',
  penaltyMinutes: number,
  reason: string,
  appliesTo: string, // 'next_match' | 'specific_match'
  matchId?: string
}
```

### 🟠 High Priority - Action Needed Soon

#### 6. Match in 1 Hour
**Trigger:** 1 hour before scheduled match time
**Target:** Team captain + all players
**Action Required:** Prepare to join lobby
**Storage:** Real-time check against `matches` collection
```typescript
{
  type: 'match_imminent',
  priority: 'high',
  matchId: string,
  opponentName: string,
  matchTime: timestamp,
  lobbyInfo: object
}
```

#### 7. Match in 24 Hours
**Trigger:** 24 hours before scheduled match time
**Target:** Team captain
**Action Required:** Verify roster, check pre-match checklist
**Storage:** Real-time check against `matches` collection
```typescript
{
  type: 'match_reminder_24h',
  priority: 'high',
  matchId: string,
  opponentName: string,
  checklistComplete: boolean
}
```

#### 8. Coach Deadline Approaching (No Coach Registered)
**Trigger:** <24h until match and no coach registered
**Target:** Team captain
**Action Required:** Register coach or proceed without one
**Storage:** Real-time check against `match.coachInfo`
```typescript
{
  type: 'coach_deadline_approaching',
  priority: 'high',
  matchId: string,
  hoursUntilMatch: number
}
```

#### 9. Transfer Window Opens
**Trigger:** Transfer window opens (admin action)
**Target:** All team captains
**Action Required:** Optional roster changes
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'transfer_window_opened',
  priority: 'high',
  windowCloses: timestamp,
  maxTransfers: number
}
```

#### 10. Transfer Window Closes in 24h
**Trigger:** 24h before transfer window closes
**Target:** All team captains
**Action Required:** Finalize roster changes
**Storage:** Real-time check against tournament config
```typescript
{
  type: 'transfer_window_closing',
  priority: 'high',
  deadline: timestamp,
  remainingTransfers: number
}
```

### 🟡 Medium Priority - Response Expected

#### 11. Standin Request Status Update (Approved)
**Trigger:** Opponent captain approves your standin request
**Target:** Requesting team captain
**Action Required:** Acknowledge, ensure standin is ready
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'standin_request_approved',
  priority: 'medium',
  requestId: string,
  matchId: string,
  standinName: string
}
```

#### 12. Standin Request Status Update (Denied)
**Trigger:** Opponent captain denies your standin request
**Target:** Requesting team captain
**Action Required:** Find alternative solution or appeal to admin
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'standin_request_denied',
  priority: 'medium',
  requestId: string,
  matchId: string,
  standinName: string,
  denialReason?: string
}
```

#### 13. Match Reschedule Status Update (Approved)
**Trigger:** Opponent or admin approves reschedule request
**Target:** Requesting team captain
**Action Required:** Prepare for new match date
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'reschedule_request_approved',
  priority: 'medium',
  matchId: string,
  newDate: timestamp,
  approvedBy: 'opponent' | 'admin'
}
```

#### 14. Match Reschedule Status Update (Denied)
**Trigger:** Opponent or admin denies reschedule request
**Target:** Requesting team captain
**Action Required:** Prepare for original match date
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'reschedule_request_denied',
  priority: 'medium',
  matchId: string,
  denialReason?: string,
  deniedBy: 'opponent' | 'admin'
}
```

#### 15. Match Result Submitted (Verification Needed)
**Trigger:** Opponent captain submits match result
**Target:** Team captain
**Action Required:** Verify and confirm result
**Storage:** Derived from `match.status` change
```typescript
{
  type: 'match_result_submitted',
  priority: 'medium',
  matchId: string,
  submittedScore: string,
  submittedBy: string,
  verificationDeadline: timestamp
}
```

### 🟢 Low Priority - Informational

#### 16. Admin Announcement
**Trigger:** Admin posts tournament-wide announcement
**Target:** All teams/players
**Action Required:** Read and acknowledge
**Storage:** Derived from `announcements` collection
```typescript
{
  type: 'admin_announcement',
  priority: 'low' | 'medium', // based on announcement urgency
  title: string,
  message: string,
  urgent: boolean
}
```

#### 17. Division Standings Updated
**Trigger:** After all matches in a round complete
**Target:** All teams in division
**Action Required:** Review standings
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'standings_updated',
  priority: 'low',
  divisionId: string,
  roundNumber: number,
  teamPosition: number,
  positionChange: number // +/- from previous round
}
```

#### 18. Promotion/Relegation Match Scheduled
**Trigger:** Team qualifies for promo/relegation match
**Target:** Team captain + all players
**Action Required:** Prepare for high-stakes match
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'promotion_relegation_match',
  priority: 'medium',
  matchType: 'promotion' | 'relegation',
  matchId: string,
  opponentName: string,
  divisionMovement: string // "Elite → Challenger" or "Challenger → Adept"
}
```

#### 19. Player Joined Team
**Trigger:** Player accepts transfer/loan to team
**Target:** Team captain
**Action Required:** None
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'player_joined',
  priority: 'low',
  playerName: string,
  playerSteamId: string,
  joinType: 'transfer' | 'loan' | 'registration'
}
```

#### 20. Player Left Team
**Trigger:** Player transfers away or is removed
**Target:** Team captain
**Action Required:** None (informational)
**Storage:** `tournaments/{id}/notifications` collection
```typescript
{
  type: 'player_left',
  priority: 'low',
  playerName: string,
  leaveType: 'transfer' | 'removal' | 'voluntary'
}
```

---

## Database Storage Strategy

### Option A: Dedicated Notifications Collection (RECOMMENDED)

**Structure:**
```
/tournaments/{tournamentId}/notifications/{notificationId}
  - type: string
  - priority: 'critical' | 'high' | 'medium' | 'low'
  - recipientType: 'team' | 'player' | 'captain'
  - recipientId: string (teamId or userId)
  - title: string
  - message: string
  - metadata: object (notification-specific data)
  - createdAt: timestamp
  - expiresAt?: timestamp
  - read: boolean
  - dismissed: boolean
  - actionable: boolean
  - actionTaken?: boolean
  - actionTakenAt?: timestamp
```

**Advantages:**
- ✅ Track read/dismissed state per recipient
- ✅ Notification history and audit trail
- ✅ Support for notifications not tied to other entities
- ✅ Easy to query unread/actionable notifications
- ✅ Can add expiration for automatic cleanup

**Queries:**
```typescript
// Get all unread notifications for a team
const q = query(
  collection(db, `tournaments/${tournamentId}/notifications`),
  where('recipientId', '==', teamId),
  where('read', '==', false),
  orderBy('priority', 'desc'),
  orderBy('createdAt', 'desc')
);

// Get all actionable notifications
const q = query(
  collection(db, `tournaments/${tournamentId}/notifications`),
  where('recipientId', '==', teamId),
  where('actionable', '==', true),
  where('actionTaken', '==', false)
);
```

### Option B: Hybrid Approach (ALTERNATIVE)

Store only persistent notifications in database:
- Admin messages
- Status updates (standin approved/denied, reschedule approved/denied)
- Time penalties
- Announcements
- Standings updates
- Team roster changes

Derive ephemeral notifications from existing data:
- Match reminders (from `matches` collection)
- Pending approvals (from `standinRequests`, `match.rescheduleRequest`)
- Coach deadlines (from `match.coachInfo`)

**Advantages:**
- ✅ Less data duplication
- ✅ Always in sync with source data
- ✅ Reduced write operations

**Disadvantages:**
- ❌ Can't track read state for derived notifications
- ❌ No history of time-sensitive notifications
- ❌ More complex query logic

---

## Implementation Recommendation

**Use Option A (Dedicated Collection)** because:

1. **User Experience:** Users need to mark notifications as read and dismiss them
2. **Notification History:** Important for accountability and audit trail
3. **Flexibility:** Easy to add new notification types without changing other collections
4. **Performance:** Single query to fetch all notifications, not multiple queries across collections
5. **Future Features:** Enables push notifications, email digests, notification preferences

### Cloud Function Triggers

Implement Cloud Functions to automatically create notifications:

```typescript
// When standin request is created
exports.onStandinRequestCreated = functions.firestore
  .document('tournaments/{tournamentId}/standinRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const opponentTeamId = /* get opponent team */;
    
    await admin.firestore()
      .collection(`tournaments/${context.params.tournamentId}/notifications`)
      .add({
        type: 'standin_approval_required',
        priority: 'critical',
        recipientType: 'captain',
        recipientId: opponentTeamId,
        title: 'Wniosek o standina wymaga zatwierdzenia',
        message: `${request.requestingTeamName} prosi o zatwierdzenie standina`,
        metadata: {
          requestId: snap.id,
          matchId: request.matchId,
          standinName: request.standinNickname
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        dismissed: false,
        actionable: true,
        actionTaken: false
      });
  });
```

### Scheduled Functions

For time-based notifications:

```typescript
// Check for upcoming matches every 10 minutes
exports.checkUpcomingMatches = functions.pubsub
  .schedule('*/10 * * * *')
  .onRun(async (context) => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Query matches starting within the next hour
    // Create notifications if they don't already exist
  });
```

---

## Next Steps

1. **Create Notification Type Definitions** in `src/lib/definitions.ts`
2. **Implement Notification Service** in `src/lib/notifications.ts`
3. **Update PDLNotificationCenter** to read from database
4. **Create Cloud Functions** for automatic notification generation
5. **Add Notification Management API** (mark as read, dismiss, take action)
6. **Add i18n translations** for all notification types
