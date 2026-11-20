// The tournament document's flat keys, grouped into the four JSON columns of `tournaments`
// (SCHEMA.md 4.1 to 4.4, field list in 7.1). Values are taken as they are; anything that does
// not fit a column's schema is reported by fitJson and left out.

import { featuresSchema, presentationSchema, settingsSchema, themeSchema } from '@/platform/db/schema/json';
import { readTime, toBool, toInt, toNumber, toText, withoutNulls } from '../values';
import type { Doc } from '../source';
import { arr, iso, obj, type Data } from './read';
import { fitJson, type MapState } from './state';

const KIND = 'tournaments';

/** Theme keys of the old flat theme, by their place in the new one. */
const THEME_COLORS: Record<string, string> = {
  primary: 'primaryColor', secondary: 'secondaryColor', accent: 'accentColor', background: 'backgroundColor',
  backgroundGradient: 'backgroundGradient', card: 'cardColor', text: 'textColor', mutedText: 'mutedTextColor',
  border: 'borderColor', glow: 'glowColor', heading: 'headingColor', link: 'linkColor', title: 'titleColor',
  sectionHeader: 'sectionHeaderColor', primaryText: 'primaryTextColor', secondaryText: 'secondaryTextColor',
  navbar: 'navbarColor', navbarText: 'navbarTextColor',
};
const THEME_FONTS: Record<string, string> = {
  header: 'headerFont', body: 'bodyFont', text: 'textFont', readable: 'readableFont', rulesContent: 'rulesContentFont', navbar: 'navbarFont',
};
const THEME_OTHER = new Set([
  'backgroundImageUrl', 'backgroundOverlayColor', 'backgroundOverlayOpacity', 'backgroundBlur', 'backgroundPosition',
  'backgroundSize', 'navbarStyle', 'navbarOpacity', 'navbarBlur', 'cardOpacity', 'cardBlur', 'cardBorderRadius',
  'themeStyle', 'logoUrl', 'inlineLogoUrl', 'organizerLogoUrl', 'faviconUrl',
]);

const pick = (source: Data, map: Record<string, string>) =>
  withoutNulls(Object.fromEntries(Object.entries(map).map(([to, from]) => [to, toText(source[from]) ?? undefined])));

export function mapTheme(state: MapState, doc: Doc): unknown {
  const t = obj(doc.data.theme);
  const known = new Set([...Object.values(THEME_COLORS), ...Object.values(THEME_FONTS), ...THEME_OTHER]);
  for (const key of Object.keys(t)) {
    if (!known.has(key)) state.ctx.finding({ kind: KIND, code: 'unknown-field', reason: `theme key "${key}" is not imported`, ref: doc.path });
  }
  const theme = {
    version: 1,
    colors: pick(t, THEME_COLORS),
    fonts: { ...pick(t, THEME_FONTS), custom: arr(doc.data.customFonts).map((f) => withoutNulls(obj(f))) },
    background: withoutNulls({
      imageUrl: toText(t.backgroundImageUrl), overlayColor: toText(t.backgroundOverlayColor),
      overlayOpacity: toNumber(t.backgroundOverlayOpacity), blur: toNumber(t.backgroundBlur),
      position: toText(t.backgroundPosition), size: toText(t.backgroundSize),
    }),
    navbar: withoutNulls({ style: toText(t.navbarStyle) ?? 'solid', opacity: toNumber(t.navbarOpacity), blur: toNumber(t.navbarBlur) }),
    card: withoutNulls({ opacity: toNumber(t.cardOpacity), blur: toNumber(t.cardBlur), radius: toText(t.cardBorderRadius) }),
    mode: toText(t.themeStyle) ?? 'dark',
    logos: withoutNulls({
      main: toText(t.logoUrl), inline: toText(t.inlineLogoUrl), organizer: toText(t.organizerLogoUrl), favicon: toText(t.faviconUrl),
    }),
  };
  return fitJson(state, themeSchema, theme, `${KIND} ${doc.path} theme`);
}

function heroMedia(value: unknown): Data | undefined {
  const media = obj(value);
  const out: Data = {};
  for (const [slot, raw] of Object.entries(media)) {
    const v = obj(raw);
    const video = obj(v.video);
    out[slot] = withoutNulls({
      type: toText(v.type),
      video: video.url ? withoutNulls({ url: toText(video.url), mobileUrl: toText(video.mobileUrl), posterUrl: toText(video.posterUrl), bunnyVideoId: toText(video.bunnyVideoId) }) : undefined,
    });
  }
  return Object.keys(out).length ? out : undefined;
}

export function mapPresentation(state: MapState, doc: Doc): unknown {
  const d = doc.data;
  const sponsor = obj(d.navbarSponsor);
  for (const legacy of ['sponsorName', 'sponsorImageUrl', 'sponsorUrl', 'secondaryText']) {
    if (sponsor[legacy] !== undefined && sponsor[legacy] !== null) {
      state.ctx.finding({ kind: KIND, code: 'decision', reason: `navbarSponsor.${legacy} dropped (unused legacy key, SCHEMA.md 7.1)`, ref: doc.path });
    }
  }
  const value = {
    hero: withoutNulls({
      title: toText(d.heroTitle), layout: toText(d.heroLayout), leftImageUrl: toText(d.heroLeftImageUrl),
      rightImageUrl: toText(d.heroRightImageUrl), promoImageUrl: toText(d.promotionalImageUrl),
      media: heroMedia(d.heroMedia), videoCrt: toBool(d.heroVideoCrt), trailerUrl: toText(d.trailerUrl),
    }),
    sponsor: withoutNulls({
      enabled: toBool(sponsor.enabled) ?? false,
      slides: arr(sponsor.slides).map((s) => withoutNulls(obj(s))),
      url: toText(sponsor.url), intervalMs: toInt(sponsor.intervalMs), widthPx: toInt(sponsor.widthPx),
    }),
    links: withoutNulls({
      twitch: toText(d.twitchUrl), discord: toText(d.discordUrl), youtube: toText(d.youtubeUrl),
      instagram: toText(d.instagramUrl), tiktok: toText(d.tiktokUrl),
    }),
    prizesPage: withoutNulls({ displayMode: toText(d.prizesDisplayMode), imageUrl: toText(d.prizesImageUrl) }),
  };
  return fitJson(state, presentationSchema, value, `${KIND} ${doc.path} presentation`);
}

/** A date or time for a JSON column: date-only values (`2026-10-16`) are midnight in Warsaw. */
const isoTime = (value: unknown) => iso(readTime(value).value);

/** The nested value wins over the older top-level copy; a disagreement is reported (SCHEMA.md 7.1). */
function preferNested(state: MapState, doc: Doc, name: string, nested: unknown, top: unknown): unknown {
  const n = nested === '' ? null : nested;
  const t = top === '' ? null : top;
  if (n !== undefined && n !== null && t !== undefined && t !== null && String(n) !== String(t)) {
    state.ctx.finding({ kind: KIND, code: 'conflict', reason: `${name}: the nested and the top-level value differ; the nested one is used`, ref: `${doc.path} ${String(n)} / ${String(t)}` });
  }
  return n ?? t;
}

const SCHEDULING: Record<string, string> = { 'admin-scheduled': 'admin', 'captain-scheduled': 'captain', admin: 'admin', captain: 'captain', fixed: 'fixed' };

export function mapSettings(state: MapState, doc: Doc): unknown {
  const d = doc.data;
  const reg = obj(d.registration);
  const teams = obj(d.teams);
  const matches = obj(d.matches);
  const standins = obj(d.standins);
  const lobby = obj(d.lobbySettings);
  const discord = obj(d.discordServer);
  const method = toText(d.schedulingMethod) ?? toText(matches.schedulingMethod);
  const positive = (v: unknown) => { const n = toInt(v); return n !== null && n > 0 ? n : null; };
  const value = {
    registration: withoutNulls({
      enabled: toBool(reg.enabled) ?? false,
      opensAt: isoTime(preferNested(state, doc, 'registration start', reg.startDate, d.registrationStartDate)),
      closesAt: isoTime(preferNested(state, doc, 'registration end', reg.endDate, d.registrationEndDate)),
      maxTeams: positive(preferNested(state, doc, 'maximum teams', reg.maxTeams, d.maxTeams)),
      requireApproval: toBool(reg.requireApproval) ?? false,
    }),
    teams: withoutNulls({
      size: positive(d.teamSize) ?? 5, minPlayers: positive(teams.minPlayers), maxPlayers: positive(teams.maxPlayers),
      allowSubstitutes: toBool(teams.allowSubstitutes), maxSubstitutes: toInt(teams.maxSubstitutes),
      mmrCap: positive(preferNested(state, doc, 'MMR cap', teams.mmrCap, d.mmrCap)),
      mmrVerification: toBool(teams.mmrVerification) ?? toBool(d.mmrVerificationRequired) ?? false,
      coachMode: toText(d.coachMode) ?? 'disabled', requireCoach: toBool(teams.requireCoach),
    }),
    scheduling: withoutNulls({
      method: SCHEDULING[method ?? ''] ?? 'captain',
      rescheduleRangeDays: toInt(d.rescheduleRangeDays), rescheduleFinalAt: isoTime(d.rescheduleFinalDate),
      rescheduleEarlierOnly: toBool(d.rescheduleEarlierOnly), forfeitMinutes: toInt(matches.forfeitTime),
      lateGraceMinutes: toInt(matches.lateArrivalGracePeriod),
    }),
    standins: withoutNulls({
      enabled: toBool(standins.enabled) ?? false, requireRegistration: toBool(standins.requireRegistration) ?? false,
      requireOpponentApproval: toBool(standins.requireOpponentApproval) ?? false, adminCanOverride: toBool(standins.adminCanOverride) ?? false,
      maxPerMatch: toInt(standins.maxPerMatch) ?? 1, maxPerRound: toInt(standins.maxPerRound), mmrRestrictions: toBool(standins.mmrRestrictions) ?? false,
    }),
    transfers: withoutNulls({
      windowOpen: toBool(d.transferWindowOpen) ?? false, maxPerWindow: toInt(d.maxTransfersPerWindow), maxPerSeason: toInt(d.maxTransfersPerSeason),
    }),
    discord: withoutNulls({ guildId: toText(discord.guildId), requireMember: toBool(discord.requireMember) }),
    lobby: withoutNulls({
      leagueName: toText(lobby.leagueName), gameMode: toText(lobby.gameMode), server: toText(lobby.server), visibility: toText(lobby.visibility),
      dotatvDelayMinutes: toInt(lobby.dotatvDelayMinutes), latePenaltyGameMinutes: toInt(lobby.latePenaltyGameMinutes),
      latePenaltySeriesMinutes: toInt(lobby.latePenaltySeriesMinutes), botLobbyEnabled: toBool(lobby.botLobbyEnabled),
      selectionPriorityRules: toInt(lobby.selectionPriorityRules),
    }),
  };
  if (state.options.anonymize) value.discord = {};
  return fitJson(state, settingsSchema, value, `${KIND} ${doc.path} settings`);
}

export function mapFeatures(state: MapState, doc: Doc): unknown {
  const d = doc.data;
  const f = obj(d.fantasy);
  const p = obj(d.pickem);
  const c = d.cardSettings === undefined || d.cardSettings === null ? null : obj(d.cardSettings);
  const value = {
    fantasy: withoutNulls({
      enabled: toBool(f.enabled) ?? false, type: toText(f.type) ?? 'round-based', rosterSize: toInt(f.rosterSize) ?? 5,
      budget: toNumber(f.budget) ?? 0, budgetType: toText(f.budgetType), maxTransfersPerRound: toInt(f.maxTransfersPerRound),
      lockBeforeMatchday: toBool(f.lockBeforeMatchday) ?? f.lockTime === 'before-matchday',
      lockTime: toText(f.lockTime), priceChangePercentage: toNumber(f.priceChangePercentage),
      legacyScoring: f.scoring && typeof f.scoring === 'object' ? f.scoring : undefined,
    }),
    pickem: withoutNulls({
      enabled: toBool(p.enabled) ?? false, matchPredictions: toBool(p.matchPredictions) ?? false,
      standingsPredictions: toBool(p.standingsPredictions) ?? false, playoffBracket: toBool(p.playoffBracket) ?? false,
      mvpPredictions: toBool(p.mvpPredictions) ?? false, lockTime: toText(p.lockTime) ?? 'before-season',
      byeTeamsCount: toInt(p.byeTeamsCount), instructionsMarkdown: toText(p.instructionsMarkdown), submissionDeadline: isoTime(p.submissionDeadline),
    }),
    cards: withoutNulls({
      enabled: c !== null, roundPacks: toInt(c?.roundPacks) ?? 0, howTo: toText(c?.howTo),
      twitchChannels: arr(c?.twitchChannels).map(String),
    }),
    prizes: { enabled: toBool(d.prizesEnabled) ?? false },
  };
  return fitJson(state, featuresSchema, value, `${KIND} ${doc.path} features`);
}
