import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { logger } from './logger';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  // Unexpected errors (DB failures, etc.) are logged with full detail server-side
  // but never echoed to the client — messages can contain connection strings,
  // stack traces, or other internals.
  logger.error('Unhandled API error', error);
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
