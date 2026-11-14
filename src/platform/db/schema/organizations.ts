// Organizations above tournaments (SCHEMA.md 2.1, ADR-05, ADR-06).

import { index, jsonb, primaryKey, text, uniqueIndex, check } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { app, createdAt, oneOf, tstz, updatedAt } from './_columns';
import { users } from './platform';
import type { brandingSchema } from './json/tournament';
import type { organizationLinksSchema } from './json/people';

export const ORGANIZATION_ROLES = ['owner', 'admin'] as const;

export const organizations = app.table('organizations', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  description: text('description'),
  links: jsonb('links').$type<z.infer<typeof organizationLinksSchema>>().notNull().default({}),
  branding: jsonb('branding').$type<z.infer<typeof brandingSchema>>().notNull().default({}),
  plan: text('plan').notNull().default('free'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('organizations_slug_unique').on(t.slug)]).enableRLS();

export const organizationMembers = app.table('organization_members', {
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ORGANIZATION_ROLES }).notNull(),
  addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
  addedAt: tstz('added_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.organizationId, t.userId] }),
  index('organization_members_user_idx').on(t.userId),
  check('organization_members_role_check', oneOf('role', ORGANIZATION_ROLES)),
]).enableRLS();

/** Editions of one league: tournaments that share a series. */
export const series = app.table('series', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: createdAt(),
}, (t) => [index('series_organization_idx').on(t.organizationId)]).enableRLS();
