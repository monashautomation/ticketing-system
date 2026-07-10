import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from './session';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: error.flatten() },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
