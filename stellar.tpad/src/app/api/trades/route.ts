import { NextRequest, NextResponse } from 'next/server';
import { tradeStore } from '@/lib/stores';
import type { TradeRecord } from '@/types';

const REQUIRED = ['tokenId', 'type', 'tokenAmount', 'xlmAmount', 'price', 'fee', 'user', 'txHash', 'timestamp'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    for (const field of REQUIRED) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ success: false, error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const record: TradeRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      tokenId:     body.tokenId,
      type:        body.type,
      tokenAmount: String(body.tokenAmount),
      xlmAmount:   String(body.xlmAmount),
      price:       Number(body.price),
      fee:         String(body.fee),
      user:        body.user,
      txHash:      body.txHash,
      timestamp:   body.timestamp,
    };

    const existing = tradeStore.get(record.tokenId) ?? [];
    existing.unshift(record);
    tradeStore.set(record.tokenId, existing);

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get('tokenId');
  if (!tokenId) {
    return NextResponse.json({ success: false, error: 'tokenId is required' }, { status: 400 });
  }

  const trades = (tradeStore.get(tokenId) ?? [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  return NextResponse.json({ success: true, data: trades });
}
