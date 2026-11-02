import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrGuest } from '@/lib/auth';
import {
  createStudyHistoryRecord,
  getStudyHistoryForUser,
  deleteStudyHistoryRecord,
  clearStudyHistoryForUser,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrGuest();
    const searchParams = req.nextUrl.searchParams;

    const rawType = searchParams.get('type');
    const activityType =
      rawType === 'learn' || rawType === 'practice' ? rawType : undefined;

    const rawLimit = searchParams.get('limit');
    const limit = rawLimit ? Math.min(100, Math.max(1, parseInt(rawLimit, 10))) : 50;

    const history = await getStudyHistoryForUser(user.id, activityType, limit);

    return NextResponse.json({
      success: true,
      userId: user.id,
      history,
    });
  } catch (err: any) {
    console.error('GET /api/history error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve study history', details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrGuest();
    const body = await req.json();

    const {
      activity_type,
      topic,
      raw_problem,
      latex_equation,
      score_earned,
      score_total,
      solution_payload,
    } = body;

    if (!activity_type || (activity_type !== 'learn' && activity_type !== 'practice')) {
      return NextResponse.json(
        { error: 'Invalid or missing activity_type (must be "learn" or "practice")' },
        { status: 400 }
      );
    }

    if (!raw_problem || typeof raw_problem !== 'string') {
      return NextResponse.json(
        { error: 'Missing required "raw_problem" string' },
        { status: 400 }
      );
    }

    // Safety guard: Limit payload size to 250KB
    const serializedPayload =
      typeof solution_payload === 'string'
        ? solution_payload.slice(0, 250_000)
        : solution_payload
        ? JSON.stringify(solution_payload).slice(0, 250_000)
        : null;

    const record = await createStudyHistoryRecord({
      user_id: user.id,
      activity_type,
      topic: topic || 'General Mathematics',
      raw_problem: raw_problem.slice(0, 2000),
      latex_equation: latex_equation ? String(latex_equation).slice(0, 2000) : null,
      score_earned: typeof score_earned === 'number' ? score_earned : null,
      score_total: typeof score_total === 'number' ? score_total : null,
      solution_payload: serializedPayload,
    });

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (err: any) {
    console.error('POST /api/history error:', err);
    return NextResponse.json(
      { error: 'Failed to record study history', details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrGuest();
    const searchParams = req.nextUrl.searchParams;

    const clearAll = searchParams.get('all') === 'true';
    const id = searchParams.get('id');

    if (clearAll) {
      await clearStudyHistoryForUser(user.id);
      return NextResponse.json({ success: true, clearedAll: true });
    }

    if (id) {
      const deleted = await deleteStudyHistoryRecord(id, user.id);
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json(
      { error: 'Specify either ?id=<id> or ?all=true to delete history' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('DELETE /api/history error:', err);
    return NextResponse.json(
      { error: 'Failed to delete study history', details: err?.message },
      { status: 500 }
    );
  }
}
