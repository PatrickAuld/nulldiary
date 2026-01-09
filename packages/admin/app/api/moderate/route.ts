import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { moderateSubmission } from '@/lib/db';

export async function POST(request: Request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, action, notes, featured } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Missing id or action' },
        { status: 400 }
      );
    }

    const validActions = ['approve', 'reject', 'spam', 'unreview'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    await moderateSubmission(id, action, 'admin', notes, featured);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json(
      { error: 'Moderation failed' },
      { status: 500 }
    );
  }
}
