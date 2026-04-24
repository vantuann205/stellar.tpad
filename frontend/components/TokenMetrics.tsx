'use client'

import React from 'react'
import { formatMarketCap, formatVolume, formatPriceChange, formatPriceChangeColor, formatTraderCount } from '../utils/formatters'

interface TokenMetricsProps {
    token?: {
        marketcap?: number | string
        volume_24h?: number | string
        price_change_5m?: number | string
        price_change_1h?: number | string
        price_change_6h?: number | string
        trader_count?: number | string
    }
}

export default function TokenMetrics({ token }: TokenMetricsProps) {
    if (!token) {
        return null;
    }

    return null;
}
