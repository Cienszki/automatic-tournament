// src/app/api/manage/bot/accounts/[id]/route.ts
// Per-account operations: enable/disable, update, delete

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/lib/require-admin';
import { deleteBotAccount, updateBotAccount } from '@/lib/bot/bot-config-actions';

/**
 * PATCH /api/manage/bot/accounts/[id]
 * Update a bot account (toggle enabled, change displayName/notes, reset password).
 * Body: { enabled?: boolean, displayName?: string, notes?: string, password?: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Super admins only: these routes hand out and change the Steam accounts every lobby runs on.
    const caller = await requireAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;
    const body = await req.json() as {
      enabled?: boolean;
      displayName?: string;
      notes?: string;
      username?: string;
      password?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.displayName !== undefined) updates.displayName = body.displayName.trim();
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.username?.trim()) updates.username = body.username.trim();

    // If a new password is provided, re-encode it
    if (body.password?.trim()) {
      updates.encryptedPassword = Buffer.from(body.password, 'utf-8').toString('base64');
    }

    const result = await updateBotAccount(
      id,
      updates as Parameters<typeof updateBotAccount>[1]
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot accounts PATCH error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/manage/bot/accounts/[id]
 * Remove a bot account (only if idle/offline).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Super admins only: these routes hand out and change the Steam accounts every lobby runs on.
    const caller = await requireAdmin(req);
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;

    const result = await deleteBotAccount(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Bot accounts DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
