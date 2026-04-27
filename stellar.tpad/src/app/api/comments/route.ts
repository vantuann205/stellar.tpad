import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const tokenId = request.nextUrl.searchParams.get('tokenId');

        if (!tokenId) {
            return NextResponse.json(
                { error: 'Missing tokenId parameter' },
                { status: 400 }
            );
        }

        const result = await query(
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
            data: result?.rows || [],
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch comments',
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tokenId, user, userAddress, text } = body;
        const resolvedUser = userAddress || user;

        if (!tokenId || !resolvedUser || !text) {
            return NextResponse.json(
                { error: 'Missing required fields: tokenId, userAddress, text' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO comments (token_id, user_address, comment_text, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             RETURNING *`,
            [tokenId, resolvedUser, text]
        ) as any;

        return NextResponse.json({
            success: true,
            data: result?.rows?.[0] || null,
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create comment',
            },
            { status: 500 }
        );
    }
}
