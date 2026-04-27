import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';
import { calculateAndStoreTokenMetrics } from '@/lib/token-metrics';

export async function POST(request: NextRequest) {
    try {
        await ensureDatabaseSchema();
        const body = await request.json();
        const {
            token_id,
            buyer_address,
            seller_address,
            quantity,
            sold_supply,
            price_per_token,
            total_price,
            transaction_hash,
            status,
        } = body;

        if (!token_id || !price_per_token || !total_price) {
            return NextResponse.json(
                { error: 'Missing required fields: token_id, price_per_token, total_price' },
                { status: 400 }
            );
        }

        if (!buyer_address && !seller_address) {
            return NextResponse.json(
                { error: 'Either buyer_address or seller_address must be provided' },
                { status: 400 }
            );
        }

        if (!quantity) {
            return NextResponse.json(
                { error: 'quantity is required' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO purchases (
                token_id,
                buyer_address,
                seller_address,
                quantity,
                price_per_token,
                total_price,
                transaction_hash,
                status,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *`,
            [
                token_id,
                buyer_address || null,
                seller_address || null,
                quantity,
                price_per_token,
                total_price,
                transaction_hash || null,
                status || 'completed',
            ]
        ) as any;

        // Recalculate token metrics immediately so price/chart/market cap stay in sync after each trade.
        if ((status || 'completed') === 'completed') {
            try {
                // sold_supply MUST be updated — it's the source of truth for price calculation
                if (sold_supply !== undefined && sold_supply !== null && Number(sold_supply) >= 0) {
                    await query(
                        `UPDATE tokens
                         SET sold_supply = $2,
                             updated_at = NOW()
                         WHERE id = $1`,
                        [Number(token_id), Number(sold_supply)]
                    );
                    console.log(`[purchases] Updated sold_supply=${sold_supply} for token_id=${token_id}`);
                } else {
                    console.warn(`[purchases] sold_supply not provided for token_id=${token_id} — price may be stale`);
                }

                await calculateAndStoreTokenMetrics({
                    tokenId: Number(token_id),
                    currentPrice: price_per_token,
                    recordSnapshot: true,
                });
            } catch (metricsError) {
                console.warn('Purchase saved, but metrics update failed:', metricsError);
            }
        }

        return NextResponse.json({ success: true, data: result?.rows?.[0] });
    } catch (error) {
        console.error('Error creating purchase:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to create purchase' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        await ensureDatabaseSchema();
        const tokenId = request.nextUrl.searchParams.get('token_id');
        const buyerAddress = request.nextUrl.searchParams.get('buyer_address');
        const sellerAddress = request.nextUrl.searchParams.get('seller_address');
        const contractAddress = request.nextUrl.searchParams.get('contract_address');
        const status = request.nextUrl.searchParams.get('status');
        const walletAddress = request.nextUrl.searchParams.get('wallet_address');

        const params: any[] = [];
        const conditions: string[] = [];

        if (tokenId) {
            conditions.push(`p.token_id = $${params.length + 1}`);
            params.push(parseInt(tokenId));
        }
        if (buyerAddress) {
            conditions.push(`LOWER(p.buyer_address) = LOWER($${params.length + 1})`);
            params.push(buyerAddress);
        }
        if (sellerAddress) {
            conditions.push(`LOWER(p.seller_address) = LOWER($${params.length + 1})`);
            params.push(sellerAddress);
        }
        if (status) {
            conditions.push(`p.status = $${params.length + 1}`);
            params.push(status);
        }
        if (contractAddress) {
            conditions.push(`LOWER(t.contract_address) = LOWER($${params.length + 1})`);
            params.push(contractAddress);
        }
        // For convenience, if wallet_address is provided, get both buys and sells
        if (walletAddress && !buyerAddress && !sellerAddress) {
            conditions.push(`(LOWER(p.buyer_address) = LOWER($${params.length + 1}) OR LOWER(p.seller_address) = LOWER($${params.length + 2}))`);
            params.push(walletAddress);
            params.push(walletAddress);
        }

        let sql = `SELECT
                        p.id, p.token_id, p.buyer_address, p.seller_address,
                        p.quantity, p.price_per_token, p.total_price,
                        p.transaction_hash, p.status, p.created_at, p.updated_at,
                        t.name, t.symbol, t.contract_address
                   FROM purchases p
                   LEFT JOIN tokens t ON p.token_id = t.id`;

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY p.created_at DESC LIMIT 500';

        const result = await query(sql, params.length > 0 ? params : undefined) as any;
        const response = NextResponse.json({ success: true, data: result?.rows || [] });
        // Cache purchases for 20 seconds to reduce database load
        response.headers.set('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
        return response;
    } catch (error) {
        console.error('Error fetching purchases:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch purchases' },
            { status: 500 }
        );
    }
}
