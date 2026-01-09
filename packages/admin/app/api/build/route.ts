import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { triggerBuild } from '@/lib/db';

export async function POST() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const buildId = await triggerBuild('admin');
    return NextResponse.json({ success: true, buildId });
  } catch (error) {
    console.error('Build trigger error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Build trigger failed' },
      { status: 500 }
    );
  }
}
