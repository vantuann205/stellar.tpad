import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const searchQuery = request.nextUrl.searchParams.get('q');

        if (!searchQuery || searchQuery.trim().length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    tokens: [],
                    wallets: [],
                },
            });
        }

        const searchTerm = `%${searchQuery.trim()}%`;

        // Search tokens by name, symbol, or contract address
        const tokensResult = await query(
            `SELECT id, name, symbol, contract_address, owner, image_url, created_at, COALESCE(marketcap, 0) as marketcap
             FROM tokens
             WHERE name ILIKE $1 
             OR symbol ILIKE $1 
             OR contract_address ILIKE $1
             ORDER BY 
               CASE 
                 WHEN name ILIKE $2 THEN 0
                 WHEN symbol ILIKE $2 THEN 1
                 ELSE 2
               END,
               created_at DESC
             LIMIT 10`,
            [searchTerm, searchQuery.trim()]
        );

        // Search wallets by address or display name
        const walletsResult = await query(
            `SELECT wallet_address, display_name, avatar_url, bio
             FROM wallets
             WHERE wallet_address ILIKE $1 
             OR display_name ILIKE $1
             ORDER BY 
               CASE 
                 WHEN wallet_address ILIKE $2 THEN 0
                 WHEN display_name ILIKE $2 THEN 1
                 ELSE 2
               END
             LIMIT 10`,
            [searchTerm, searchQuery.trim()]
        );

        return NextResponse.json({
            success: true,
            data: {
                tokens: tokensResult.rows || [],
                wallets: walletsResult.rows || [],
            },
        });
    } catch (error) {
        console.error('Error searching:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to search',
            },
            { status: 500 }
        );
    }
}
