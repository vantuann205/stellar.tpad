import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import TradingPageClient from './TradingPageClient';
import { query } from '@/lib/db';
import type { TokenRecord } from '@/types/token';

interface PageProps {
  params: { contractAddress: string };
}

// Enable ISR with 10 second revalidation
export const revalidate = 10;

async function getToken(contractAddress: string): Promise<TokenRecord | null> {
  try {
    // Direct database query - faster than API call
    const result = await query(
      `SELECT 
        id, name, symbol, description, image_url, social_link,
        total_supply, owner, contract_address,
        marketcap, volume_24h, 
        price_change_5m, price_change_1h, price_change_4h, price_change_6h,
        trader_count, current_price,
        created_at, updated_at
       FROM tokens 
       WHERE LOWER(contract_address) = LOWER($1) 
       LIMIT 1`,
      [contractAddress]
    ) as any;
    
    if (!result?.rows || result.rows.length === 0) {
      return null;
    }
    
    return result?.rows?.[0] as TokenRecord;
  } catch (error) {
    console.error('Error fetching token:', error);
    return null;
  }
}

export default async function TradingPage({ params }: PageProps) {
  const token = await getToken(params.contractAddress);
  
  if (!token) {
    notFound();
  }
  
  return <TradingPageClient token={token} contractAddress={params.contractAddress} />;
}
