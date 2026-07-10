import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { syncAuthentikUsers } from '@/lib/authentikSync';

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const result = await syncAuthentikUsers();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
