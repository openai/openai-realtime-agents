export const dynamic = 'force-dynamic';
export function GET() {
 return Response.json({ ready: Boolean(process.env.OPENAI_API_KEY?.trim()), model: process.env.REALTIME_MODEL || 'gpt-realtime-2.1' }, { headers: { 'Cache-Control': 'no-store' } });
}
