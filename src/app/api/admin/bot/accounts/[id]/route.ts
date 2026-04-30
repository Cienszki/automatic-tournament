// src/app/api/admin/bot/accounts/[id]/route.ts
// Per-account operations: enable/disable, update, delete

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/server/lib/admin';
import { deleteBotAccount, updateBotAccount } from '@/lib/bot/bot-config-actions';

/**
 * PATCH /api/admin/bot/accounts/[id]
 * Update a bot account (toggle enabled, change displayName/notes, reset password).
 * Body: { enabled?: boolean, displayName?: string, notes?: string, password?: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
 * DELETE /api/admin/bot/accounts/[id]
 * Remove a bot account (only if idle/offline).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
