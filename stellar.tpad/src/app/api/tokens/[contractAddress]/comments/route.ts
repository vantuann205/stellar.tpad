import { NextRequest, NextResponse } from 'next/server';
import { getTokenStore, getCommentStore } from '@/lib/stores';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    const tokenStore = await getTokenStore();
    const commentStore = await getCommentStore();
    
    const token = tokenStore.getByContractAddress(params.contractAddress);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const comments = commentStore.getByTokenId(token.id);
    
    return NextResponse.json({
      success: true,
      data: comments.map(c => ({
        id: c.id,
        user: c.user_address.length > 10 
          ? c.user_address.slice(0, 6) + '...' + c.user_address.slice(-4)
          : c.user_address,
        avatarUrl: c.avatar_url,
        text: c.comment_text,
        timestamp: new Date(c.created_at).toLocaleString(),
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
    const tokenStore = await getTokenStore();
    const commentStore = await getCommentStore();
    
    const token = tokenStore.getByContractAddress(params.contractAddress);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const body = await request.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Comment text is required' }, { status: 400 });
    }

    // TODO: Get actual user address from wallet connection
    const userAddress = 'Anonymous';

    const comment = commentStore.create({
      token_id: token.id,
      user_address: userAddress,
      comment_text: text.trim(),
      avatar_url: null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: comment.id,
        user: userAddress,
        text: comment.comment_text,
        timestamp: new Date(comment.created_at).toLocaleString(),
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 });
  }
}
