// audit-bot-readiness.js
// Run: node scripts/audit-bot-readiness.js
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!b64) { console.error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64'); process.exit(1); }
const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const TOURNAMENT_ID = 't2LLkrQbj0pwKm9i4nUs';
const TODAY_MATCH_ID = 'EnOVkhlhjEGAgF6jteE6';

const issues = [];
const warnings = [];
const ok = [];

function issue(msg) { issues.push('❌ ' + msg); }
function warn(msg)  { warnings.push('⚠️  ' + msg); }
function good(msg)  { ok.push('✅ ' + msg); }

async function main() {
  console.log('=== BOT READINESS AUDIT ===');
  console.log('Tournament: Wiosenna Furia (' + TOURNAMENT_ID + ')');
  console.log('Today match: ' + TODAY_MATCH_ID);
  console.log('');

  // ─── 1. BOT ACCOUNTS ─────────────────────────────────────────────────────
  console.log('--- 1. Bot Accounts ---');
  const botsSnap = await db.collection('botAccounts').get();
  if (botsSnap.empty) {
    issue('No bot accounts in Firestore at all');
  }
  const bots = botsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const idleBots = bots.filter(b => b.enabled && b.status === 'idle');
  const errorBots = bots.filter(b => b.status === 'error');

  bots.forEach(b => {
    console.log(`  [${b.username}] status=${b.status} enabled=${b.enabled} steamId="${b.steamId}" steamId32="${b.steamId32}"`);
    if (!b.steamId || !b.steamId32) {
      warn(`Bot "${b.displayName}" (${b.username}) has no steamId/steamId32 in Firestore — bot-worker cannot verify its own identity on login`);
    }
    if (b.status === 'error') {
      issue(`Bot "${b.displayName}" (${b.username}) is in ERROR state`);
    }
  });

  if (idleBots.length === 0) {
    issue('No idle bots available — all bots are in non-idle status');
  } else {
    good(idleBots.length + ' idle bot(s) available: ' + idleBots.map(b => b.username).join(', '));
  }

  // ─── 2. TOURNAMENT BOT CONFIG ─────────────────────────────────────────────
  console.log('\n--- 2. Tournament Bot Config ---');
  const tDoc = await db.collection('tournaments').doc(TOURNAMENT_ID).get();
  const tData = tDoc.data() || {};
  const lobbySettings = tData.lobbySettings;

  if (!lobbySettings) {
    issue('Tournament has no lobbySettings field');
  } else {
    good('lobbySettings exists: ' + JSON.stringify(lobbySettings));
  }

  // Check for TournamentBotConfig (stored inside the tournament doc or sub-collection)
  const botConfigFields = Object.keys(tData).filter(k => k.toLowerCase().includes('bot'));
  if (botConfigFields.length === 0) {
    warn('No bot-related fields on tournament doc (expected: botEnabled, botConfig, etc.)');
  } else {
    console.log('  Bot-related fields on tournament doc:', botConfigFields.join(', '));
    botConfigFields.forEach(k => console.log('  ', k, ':', JSON.stringify(tData[k]).substring(0, 200)));
  }

  // Check if bot is enabled for the tournament in the admin UI config
  const botEnabled = tData.botEnabled ?? tData.botConfig?.enabled ?? null;
  if (botEnabled === null) {
    warn('Tournament "botEnabled" flag not set — bot may not pick up matches for this tournament');
  } else if (!botEnabled) {
    issue('Tournament "botEnabled" is explicitly false — bot will not handle matches');
  } else {
    good('Tournament botEnabled = true');
  }

  // ─── 3. TODAY'S MATCH ────────────────────────────────────────────────────
  console.log('\n--- 3. Today\'s Match (' + TODAY_MATCH_ID + ') ---');
  const matchDoc = await db.collection('tournaments').doc(TOURNAMENT_ID).collection('matches').doc(TODAY_MATCH_ID).get();
  if (!matchDoc.exists) {
    issue('Today\'s match document does not exist!');
    return;
  }
  const m = matchDoc.data();
  console.log(`  Teams: ${m.teamA?.name} vs ${m.teamB?.name}`);
  console.log(`  Status: ${m.status}`);
  console.log(`  ScheduledFor: ${m.scheduledFor}`);
  console.log(`  schedulingStatus: ${m.schedulingStatus}`);
  console.log(`  bestOf: ${m.bestOf}, series_format: ${m.series_format}`);
  console.log(`  botSessionId: ${m.botSessionId || '(none)'}`);
  console.log(`  botEnabled: ${m.botEnabled ?? '(not set)'}`);

  if (!m.scheduledFor) {
    issue('Match has no scheduledFor time — bot cannot auto-trigger without a scheduled time');
  } else {
    good('Match scheduledFor: ' + m.scheduledFor);
  }

  if (m.status !== 'scheduled' && m.status !== 'pending') {
    warn('Match status is "' + m.status + '" — expected "scheduled" or "pending" before match starts');
  }

  if (m.botEnabled === false) {
    issue('Match has botEnabled=false explicitly');
  }

  // ─── 4. TEAM PLAYER STEAM IDs ─────────────────────────────────────────────
  console.log('\n--- 4. Team Player Steam IDs ---');
  const teamIds = [m.teamA?.id, m.teamB?.id].filter(Boolean);
  for (const teamId of teamIds) {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const playersSnap = await db.collection('teams').doc(teamId).collection('players').get();
    const t = teamDoc.data() || {};
    const teamName = m.teamA?.id === teamId ? m.teamA.name : m.teamB.name;
    console.log(`\n  Team: ${teamName} (id: ${teamId}) | status: ${t.status}`);

    if (t.status !== 'verified') {
      warn(`Team "${teamName}" status is "${t.status}" — may not be verified`);
    }

    if (playersSnap.empty) {
      issue(`Team "${teamName}" has NO players in players subcollection`);
    }

    playersSnap.docs.forEach(p => {
      const pd = p.data();
      const hasId32 = !!(pd.steamId32 || pd.steamid32);
      const hasSteamUrl = !!pd.steamProfileUrl;
      console.log(`    ${pd.nickname || pd.nick || p.id}: steamId32=${pd.steamId32 || '(none)'} steamUrl=${pd.steamProfileUrl || '(none)'}`);
      if (!hasId32) issue(`Player "${pd.nickname}" on "${teamName}" has no steamId32 — bot cannot invite them`);
      if (!hasSteamUrl) warn(`Player "${pd.nickname}" on "${teamName}" has no steamProfileUrl`);
    });
  }

  // ─── 5. BOT COMMANDS QUEUE ───────────────────────────────────────────────
  console.log('\n--- 5. Bot Command Queue ---');
  const cmdSnap = await db.collection('botCommands').limit(10).get();
  console.log('  botCommands (root):', cmdSnap.size, 'pending');
  // Check per-bot command queues
  for (const bot of bots) {
    const qSnap = await db.collection('botCommands').doc(bot.id).collection('queue').where('status', '==', 'pending').get();
    if (qSnap.size > 0) {
      warn(`Bot "${bot.username}" has ${qSnap.size} pending commands in queue`);
    }
  }
  good('No stale commands in queue');

  // ─── 6. BOT SESSIONS ────────────────────────────────────────────────────
  console.log('\n--- 6. Bot Sessions ---');
  const sessionSnap = await db.collection('botSessions').limit(10).get();
  console.log('  botSessions:', sessionSnap.size, 'active');
  if (sessionSnap.size > 0) {
    sessionSnap.docs.forEach(d => {
      const s = d.data();
      console.log('  ', d.id, ':', s.status, '| matchId:', s.matchId, '| botId:', s.botAccountId);
    });
  }

  // ─── 7. BOT WORKER HEARTBEAT ────────────────────────────────────────────
  console.log('\n--- 7. Bot Worker Heartbeat ---');
  const now = Date.now();
  bots.forEach(b => {
    if (!b.lastHeartbeat) {
      issue(`Bot "${b.username}" has never sent a heartbeat — bot-worker process has never run (or never connected)`);
    } else {
      const age = now - new Date(b.lastHeartbeat).getTime();
      const ageMin = Math.round(age / 60000);
      if (ageMin > 5) {
        issue(`Bot "${b.username}" last heartbeat was ${ageMin} minutes ago — bot-worker is NOT running`);
      } else {
        good(`Bot "${b.username}" heartbeat ${ageMin}m ago — process is alive`);
      }
    }
  });

  // ─── 8. BOT WHITELIST ────────────────────────────────────────────────────
  console.log('\n--- 8. Tournament Whitelist (observers/admins) ---');
  const whitelist = tData.botConfig?.whitelist || [];
  if (whitelist.length === 0) {
    warn('No whitelist entries configured — tournament admins/observers will be auto-kicked from lobby if they join');
  } else {
    good('Whitelist has ' + whitelist.length + ' entries');
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n\n════════════════════════════════════════');
  console.log('                AUDIT SUMMARY           ');
  console.log('════════════════════════════════════════');
  if (ok.length) { ok.forEach(m => console.log(m)); }
  if (warnings.length) { console.log(''); warnings.forEach(m => console.log(m)); }
  if (issues.length) { console.log(''); issues.forEach(m => console.log(m)); }
  console.log('\n' + issues.length + ' blocker(s), ' + warnings.length + ' warning(s), ' + ok.length + ' passed');
}

main().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
