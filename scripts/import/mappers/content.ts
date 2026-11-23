// News, rules, prizes and scrim slots (SCHEMA.md 7.6, 7.9).

import * as s from '@/platform/db/schema';
import { fields } from '../context';
import { ancestorId, docsOf } from '../source';
import { toBestOf, toBool, toInt, toText } from '../values';
import { createdOf, timeOf, updatedOf } from './read';
import type { MapState } from './state';

const ANNOUNCEMENT_FIELDS = fields('id', 'title', 'content', 'excerpt', 'imageUrl', 'published', 'isPinned', 'isImportant', 'type', 'createdAt', 'updatedAt', 'authorId', 'createdBy', 'authorName');
const RULE_FIELDS = fields('title', 'order', 'updatedAt');
const PARAGRAPH_FIELDS = fields('content', 'commentary', 'order', 'parentId', 'updatedAt');
const PRIZE_FIELDS = fields('category', 'description', 'prizeDetails', 'order', 'visible', 'createdAt', 'updatedAt');
const SCRIM_FIELDS = fields('teamId', 'teamName', 'divisionId', 'startAt', 'endAt', 'boFormat', 'captainDiscord', 'notes', 'status', 'createdAt', 'updatedAt');
const TONES = new Set(['info', 'success', 'warning']);

export function mapContent(state: MapState): void {
  mapAnnouncements(state);
  mapRules(state);
  mapPrizes(state);
  mapScrims(state);
}

function mapAnnouncements(state: MapState): void {
  const docs = docsOf(state.capture, 'announcements');
  state.ctx.read('announcements', docs);
  for (const doc of docs) {
    state.ctx.checkFields('announcements', doc, ANNOUNCEMENT_FIELDS);
    const d = doc.data;
    const author = state.ctx.user(d.authorId ?? d.createdBy, 'announcements:authorId');
    const tone = toText(d.type) ?? 'info';
    if (!TONES.has(tone)) state.ctx.finding({ kind: 'announcements', code: 'unmapped', reason: `announcement type "${tone}" imported as info`, ref: doc.path });
    state.rows.add(s.announcements, {
      tournamentId: state.tournamentId, id: doc.id, title: toText(d.title) ?? '', body: toText(d.content) ?? '',
      excerpt: toText(d.excerpt), imageUrl: toText(d.imageUrl), tone: TONES.has(tone) ? tone : 'info',
      isPinned: toBool(d.isPinned) ?? false, isImportant: toBool(d.isImportant) ?? false, published: toBool(d.published) ?? true,
      authorUserId: author, authorName: author ? null : toText(d.authorName),
      publishedAt: createdOf(state, 'announcements', doc), updatedAt: updatedOf(state, 'announcements', doc),
    });
    state.ctx.outcome('announcements', 'mapped');
  }
}

function mapRules(state: MapState): void {
  const sections = docsOf(state.capture, 'rules');
  const paragraphs = docsOf(state.capture, 'rules.paragraphs');
  state.ctx.read('rules', sections);
  state.ctx.read('rules.paragraphs', paragraphs);
  const sectionIds = new Set(sections.map((d) => d.id));
  const paragraphIds = new Set(paragraphs.map((d) => d.id));
  for (const doc of sections) {
    state.ctx.checkFields('rules', doc, RULE_FIELDS);
    state.rows.add(s.ruleSections, {
      tournamentId: state.tournamentId, id: doc.id, position: toInt(doc.data.order) ?? 0, title: toText(doc.data.title) ?? '',
      updatedAt: updatedOf(state, 'rules', doc),
    });
    state.ctx.outcome('rules', 'mapped');
  }
  for (const doc of paragraphs) {
    state.ctx.checkFields('rules.paragraphs', doc, PARAGRAPH_FIELDS);
    const sectionId = ancestorId(doc);
    if (!sectionIds.has(sectionId)) {
      state.ctx.outcome('rules.paragraphs', 'unmapped', 'the paragraph\'s section does not exist', doc.path);
      continue;
    }
    let parentId = toText(doc.data.parentId);
    if (parentId && !paragraphIds.has(parentId)) {
      state.ctx.finding({ kind: 'rules.paragraphs', code: 'unmapped', reason: 'parentId names a paragraph that does not exist; imported as a top-level paragraph', ref: doc.path });
      parentId = null;
    }
    state.rows.add(s.ruleParagraphs, {
      tournamentId: state.tournamentId, id: doc.id, sectionId, parentId, position: toInt(doc.data.order) ?? 0,
      body: toText(doc.data.content) ?? '', commentary: toText(doc.data.commentary), updatedAt: updatedOf(state, 'rules.paragraphs', doc),
    });
    state.ctx.outcome('rules.paragraphs', 'mapped');
  }
}

function mapPrizes(state: MapState): void {
  const docs = docsOf(state.capture, 'prizes');
  state.ctx.read('prizes', docs);
  for (const doc of docs) {
    state.ctx.checkFields('prizes', doc, PRIZE_FIELDS);
    const d = doc.data;
    state.rows.add(s.prizes, {
      tournamentId: state.tournamentId, id: doc.id, category: toText(d.category) ?? '', description: toText(d.description) ?? '',
      details: toText(d.prizeDetails), position: toInt(d.order) ?? 0, visible: toBool(d.visible) ?? true,
      createdAt: createdOf(state, 'prizes', doc), updatedAt: updatedOf(state, 'prizes', doc),
    });
    state.ctx.outcome('prizes', 'mapped');
  }
}

function mapScrims(state: MapState): void {
  const docs = docsOf(state.capture, 'scrimSlots');
  state.ctx.read('scrimSlots', docs);
  for (const doc of docs) {
    state.ctx.checkFields('scrimSlots', doc, SCRIM_FIELDS);
    const d = doc.data;
    const teamId = toText(d.teamId);
    const startsAt = timeOf(state, 'scrimSlots', doc, 'startAt', d.startAt);
    const endsAt = timeOf(state, 'scrimSlots', doc, 'endAt', d.endAt);
    if (!teamId || !state.teamIds.has(teamId) || !startsAt || !endsAt || endsAt < startsAt) {
      state.ctx.outcome('scrimSlots', 'unmapped', 'a scrim slot without a known team or a valid time range', doc.path);
      continue;
    }
    const groupId = toText(d.divisionId);
    const status = toText(d.status) ?? 'active';
    if (!['active', 'taken', 'cancelled'].includes(status)) state.ctx.finding({ kind: 'scrimSlots', code: 'unmapped', reason: `scrim status "${status}" imported as active`, ref: doc.path });
    state.rows.add(s.scrimSlots, {
      tournamentId: state.tournamentId, id: doc.id, teamId, groupId: groupId && state.groupStage.has(groupId) ? groupId : null,
      startsAt, endsAt, bestOf: toBestOf(d.boFormat) ?? 1,
      contact: state.options.anonymize ? null : toText(d.captainDiscord), notes: toText(d.notes),
      status: ['active', 'taken', 'cancelled'].includes(status) ? status : 'active',
      createdAt: createdOf(state, 'scrimSlots', doc), updatedAt: updatedOf(state, 'scrimSlots', doc),
    });
    state.ctx.outcome('scrimSlots', 'mapped');
  }
}
