import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: { contractAddress: string } },
) {
  try {
    await ensureDatabaseSchema();
    const { contractAddress } = params;

    const result = await query(
      `SELECT * FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1`,
      [contractAddress]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching token:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
