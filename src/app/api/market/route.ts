import { NextResponse } from 'next/server';
import { fetchMarketOverview, fetchCandles } from '@/lib/prices';
import { analyzeEMA, generateSignal } from '@/lib/ema';
import { RISK_RULES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await fetchMarketOverview();
    const pairs = ['ETH', 'SOL', 'WBTC'];
    const balance = 1780; // ~22.47 SOL × $79

    const analyses = await Promise.all(
      pairs.map(async (pair) => {
        const candles = await fetchCandles(pair, 14);
        const ema = analyzeEMA(candles);
        const signal = ema ? generateSignal(pair, ema, balance) : null;

        return {
          pair,
          ema,
          signal,
          candles: candles.slice(-50), // last 50 for mini chart
        };
      })
    );

    // Rank pairs by signal strength
    const ranked = analyses
      .filter(a => a.ema)
      .sort((a, b) => (b.ema?.strength || 0) - (a.ema?.strength || 0));

    // Determine active session
    const hour = new Date().getUTCHours();
    let session = 'US/Americas';
    if (hour >= 1 && hour < 7) session = 'Asia';
    else if (hour >= 7 && hour < 13) session = 'Europa';

    // Macro risk check
    const macroRisk = overview.fearGreed.value < 20 ? 'EXTREME_FEAR' :
      overview.fearGreed.value < 40 ? 'FEAR' :
      overview.fearGreed.value > 80 ? 'EXTREME_GREED' :
      overview.fearGreed.value > 60 ? 'GREED' : 'NEUTRAL';

    const noTradeZone = overview.fearGreed.value < 10 || overview.fearGreed.value > 90;

    return NextResponse.json({
      overview,
      analyses: ranked,
      session,
      macroRisk,
      noTradeZone,
      rules: RISK_RULES,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}

