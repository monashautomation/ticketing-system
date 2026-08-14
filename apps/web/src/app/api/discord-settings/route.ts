import { NextResponse } from 'next/server';
import { updateDiscordSettingsSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { getDiscordSettings, updateDiscordSettings } from '@/server/discordSettings';

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getDiscordSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    const body = updateDiscordSettingsSchema.parse(await request.json());
    const settings = await updateDiscordSettings(body, session.user.id);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return handleApiError(error);
  }
}
