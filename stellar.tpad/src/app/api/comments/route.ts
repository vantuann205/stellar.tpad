import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
    CommentValidationError,
    normalizeCommentAuthor,
    normalizeCommentText,
    parseTokenId,
} from '@/lib/comment-validation';

const MAX_COMMENTS_RETURNED = 200;

function validationResponse(error: unknown) {
    if (error instanceof CommentValidationError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const tokenId = parseTokenId(request.nextUrl.searchParams.get('tokenId'));

        const result = await query(
            `SELECT c.*,
                    COALESCE(NULLIF(w.display_name, ''), c.user_address) AS username,
                    COALESCE(NULLIF(w.avatar_url, ''), '') AS avatar_url
             FROM comments c
             LEFT JOIN wallets w ON LOWER(w.wallet_address) = LOWER(c.user_address)
             WHERE c.token_id = $1
             ORDER BY c.created_at ASC
             LIMIT $2`,
            [tokenId, MAX_COMMENTS_RETURNED]
        ) as any;

        return NextResponse.json({
            success: true,
            data: result?.rows || [],
        });
    } catch (error) {
        const invalid = validationResponse(error);
        if (invalid) return invalid;

        console.error('Error fetching comments:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch comments' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { tokenId: rawTokenId, user, userAddress, text } = body as Record<string, unknown>;
        const tokenId = parseTokenId(rawTokenId);
        const author = normalizeCommentAuthor(userAddress, user);
        const commentText = normalizeCommentText(text);

        const result = await query(
            `INSERT INTO comments (token_id, user_address, comment_text, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             RETURNING *`,
            [tokenId, author, commentText]
        ) as any;

        return NextResponse.json({
            success: true,
            data: result?.rows?.[0] || null,
        });
    } catch (error) {
        const invalid = validationResponse(error);
        if (invalid) return invalid;

        // A comment on a token that does not exist trips the foreign key constraint.
        if (error instanceof Error && error.message.includes('comments_token_id_fkey')) {
            return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
        }

        console.error('Error creating comment:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create comment' },
            { status: 500 }
        );
    }
}
