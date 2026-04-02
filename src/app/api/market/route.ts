import { NextResponse } from 'next/server';
import { fetchMarketOverview, fetchCandles } from '@/lib/prices';
import { analyzeEMA, generateSignal } from '@/lib/ema';
import { RISK_RULES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await fetchMarketOverview();
    const pairs = ['ETH', 'SOL', 'WBTC'];
    const balance = 1780;

    const analyses = await Promise.all(
      pairs.map(async (pair) => {
        const candles = await fetchCandles(pair, 365);
        const ema = analyzeEMA(candles);
        const signal = ema ? generateSignal(pair, ema, balance) : null;
        return { pair, ema, signal, candles: candles.slice(-50) };
      })
    );

    const ranked = analyses
      .filter(a => a.ema)
      .sort((a, b) => (b.ema?.strength || 0) - (a.ema?.strength || 0));

    const hour = new Date().getUTCHours();
    let session = 'US/Americas';
    if (hour >= 1 && hour < 7) session = 'Asia';
    else if (hour >= 7 && hour < 13) session = 'Europa';

    const macroRisk = overview.fearGreed.value < 20 ? 'EXTREME_FEAR' :
      overview.fearGreed.value < 40 ? 'FEAR' :
      overview.fearGreed.value > 80 ? 'EXTREME_GREED' :
      overview.fearGreed.value > 60 ? 'GREED' : 'NEUTRAL';

    const noTradeZone = overview.fearGreed.value < 10 || overview.fearGreed.value > 90;

    let topPick: Record<string, unknown> | null = null;

    const withSignals = ranked.filter(a => a.signal);
    if (withSignals.length > 0 && !noTradeZone) {
      const best = withSignals[0];
      topPick = {
        pair: best.pair,
        direction: best.signal!.direction,
        entry: best.signal!.entry,
        stopLoss: best.signal!.stopLoss,
        takeProfit1: best.signal!.takeProfit1,
        takeProfit2: best.signal!.takeProfit2,
        leverage: best.signal!.leverage,
        collateral: best.signal!.collateral,
        liquidationPrice: best.signal!.liquidationPrice,
        confidence: best.ema!.strength,
        reason: 'EMA Cross ' + (best.ema!.signal === 'GOLDEN_CROSS' ? 'Golden Cross' : best.ema!.signal === 'DEATH_CROSS' ? 'Death Cross' : 'Neutral') + ' | Strength ' + best.ema!.strength.toFixed(0) + '%',
      };
    } else if (!noTradeZone && overview.prices.length > 0) {
      const sorted = [...overview.prices].filter(p => p.price > 0).sort((a, b) => b.change24h - a.change24h);
      const best = sorted[0];
      if (best) {
        const isLong = best.change24h > -3;
        const leverage = overview.fearGreed.value < 20 ? 15 : overview.fearGreed.value < 40 ? 20 : 25;
        const collateral = Math.min(balance * 0.2, 300);
        const slPercent = 0.015;
        const entry = best.price;
        const stopLoss = isLong ? entry * (1 - slPercent) : entry * (1 + slPercent);
        const tp1 = isLong ? entry * 1.01 : entry * 0.99;
        const tp2 = isLong ? entry * 1.02 : entry * 0.98;
        const liqPrice = isLong ? entry * (1 - 1 / leverage) : entry * (1 + 1 / leverage);
        const conf = Math.max(20, Math.min(80, 50 + best.change24h * 5));

        topPick = {
          pair: best.pair,
          direction: isLong ? 'LONG' : 'SHORT',
          entry,
          stopLoss: Math.round(stopLoss * 100) / 100,
          takeProfit1: Math.round(tp1 * 100) / 100,
          takeProfit2: Math.round(tp2 * 100) / 100,
          leverage,
          collateral: Math.round(collateral * 100) / 100,
          liquidationPrice: Math.round(liqPrice * 100) / 100,
          confidence: Math.round(conf),
          reason: 'Momentum ' + (best.change24h > 0 ? '+' : '') + best.change24h.toFixed(2) + '% 24h | F&G: ' + overview.fearGreed.value,
        };
      }
    }

    return NextResponse.json({
      overview,
      analyses: ranked,
      session,
      macroRisk,
      noTradeZone,
      topPick,
      rules: RISK_RULES,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
