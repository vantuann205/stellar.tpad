import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';
import { formatUtc7DateTime } from '@/lib/time';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    await ensureDatabaseSchema();

    const tokenResult = await query(
      'SELECT id FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1',
      [params.contractAddress]
    ) as any;
    if (!tokenResult?.rows || tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const tokenId = tokenResult.rows[0].id;
    const commentsResult = await query(
      `SELECT c.*, 
              COALESCE(NULLIF(w.display_name, ''), c.user_address) AS username,
              COALESCE(NULLIF(w.avatar_url, ''), '') AS avatar_url
       FROM comments c
       LEFT JOIN wallets w ON LOWER(w.wallet_address) = LOWER(c.user_address)
       WHERE c.token_id = $1
       ORDER BY c.created_at ASC`,
      [tokenId]
    ) as any;
    
    return NextResponse.json({
      success: true,
      data: (commentsResult?.rows || []).map((c: any) => ({
        id: String(c.id),
        user: c.username || c.user_address || 'Anonymous',
        avatarUrl: c.avatar_url || '',
        text: c.comment_text || '',
        timestamp: formatUtc7DateTime(c.created_at, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    await ensureDatabaseSchema();

    const tokenResult = await query(
      'SELECT id FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1',
      [params.contractAddress]
    ) as any;
    if (!tokenResult?.rows || tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const body = await request.json();
    const { text, userAddress, user } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Comment text is required' }, { status: 400 });
    }

    const resolvedUser = userAddress || user || 'Anonymous';
    const result = await query(
      `INSERT INTO comments (token_id, user_address, comment_text, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [tokenResult?.rows?.[0]?.id, resolvedUser, text.trim()]
    ) as any;
    const comment = result?.rows?.[0];

    return NextResponse.json({
      success: true,
      data: {
        id: String(comment.id),
        user: resolvedUser,
        text: comment.comment_text,
        timestamp: formatUtc7DateTime(comment.created_at),
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 });
  }
}
