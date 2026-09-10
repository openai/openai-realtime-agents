import { createSession } from '../../../server/session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return createSession(request); }
