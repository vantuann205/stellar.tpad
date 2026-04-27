import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { wallet_address, display_name, avatar_url, bio } = await request.json();

        if (!wallet_address) {
            return NextResponse.json(
                { success: false, error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        // Upsert wallet (insert if not exists, update if exists)
        const result = await query(
            `INSERT INTO wallets (wallet_address, display_name, avatar_url, bio, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (wallet_address) DO UPDATE SET
             display_name = COALESCE($2, wallets.display_name),
             avatar_url = COALESCE($3, wallets.avatar_url),
             bio = COALESCE($4, wallets.bio),
             updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [wallet_address, display_name || null, avatar_url || null, bio || null]
        ) as any;

        return NextResponse.json({
            success: true,
            message: 'Wallet saved successfully',
            wallet: result?.rows?.[0],
        });
    } catch (error) {
        console.error('Error saving wallet:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to save wallet',
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const wallet_address = request.nextUrl.searchParams.get('address');

        if (!wallet_address) {
            return NextResponse.json(
                { success: false, error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        // Get wallet profile info
        const walletResult = await query(
            'SELECT id, wallet_address, display_name, avatar_url, bio, created_at, updated_at FROM wallets WHERE wallet_address = $1',
            [wallet_address]
        ) as any;

        // Get tokens created by this wallet (minted_coins)
        let minted_coins: string[] = [];
        try {
            const mintedCoinsResult = await query(
                `SELECT DISTINCT contract_address FROM tokens WHERE LOWER(owner) = LOWER($1) ORDER BY contract_address`,
                [wallet_address]
            ) as any;
            minted_coins = mintedCoinsResult?.rows?.map((row: any) => row.contract_address) || [];
            console.log(`✅ Minted coins for ${wallet_address}:`, minted_coins);
        } catch (e) {
            console.error('Error fetching minted coins:', e);
        }

        // Get tokens purchased by this wallet (owned_coins)
        let owned_coins: string[] = [];
        try {
            const ownedCoinsResult = await query(
                `SELECT DISTINCT t.contract_address 
                 FROM purchases p
                 JOIN tokens t ON p.token_id = t.id
                 WHERE LOWER(p.buyer_address) = LOWER($1) 
                 AND COALESCE(p.quantity, 0) > 0 
                 ORDER BY t.contract_address`,
                [wallet_address]
            ) as any;
            owned_coins = ownedCoinsResult?.rows?.map((row: any) => row.contract_address) || [];
            console.log(`✅ Owned coins for ${wallet_address}:`, owned_coins);
        } catch (e) {
            console.error('Error fetching owned coins:', e);
        }

            if (!walletResult?.rows || walletResult.rows.length === 0) {
            // Return profile-less wallet (will be created on first profile edit)
            return NextResponse.json({
                success: true,
                wallet: {
                    wallet_address,
                    display_name: null,
                    avatar_url: null,
                    bio: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    owned_coins,
                    minted_coins,
                },
            });
        }

        // Return wallet with dynamically calculated coin arrays
        return NextResponse.json({
            success: true,
            wallet: {
                ...walletResult?.rows?.[0],
                owned_coins,
                minted_coins,
            },
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch wallet',
            },
            { status: 500 }
        );
    }
}
