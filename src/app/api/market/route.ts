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

    // ALL-RED FILTER: if every asset is negative 24h, recommend WAIT
    const allRed = overview.prices.length > 0 && overview.prices.every(p => p.change24h < 0);

    let topPick: Record<string, unknown> | null = null;

    // PRIORITY 1: EMA Cross signal (real technical signal)
    const withSignals = ranked.filter(a => a.signal);
    if (withSignals.length > 0 && !noTradeZone) {
      const best = withSignals[0];
      const emaMode = best.ema!.mode === 'EMA_20_200' ? 'EMA 20/200' : 'EMA 9/21';
      const crossType = best.ema!.signal === 'GOLDEN_CROSS' ? 'Golden Cross' : best.ema!.signal === 'DEATH_CROSS' ? 'Death Cross' : 'Neutral';
      const volTag = best.ema!.volumeConfirm ? '' : ' | Low Vol';

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
        reason: emaMode + ' ' + crossType + ' | Strength ' + best.ema!.strength.toFixed(0) + '%' + volTag,
      };
    }
    // PRIORITY 2: Momentum fallback — ONLY if not all assets are red
    else if (!noTradeZone && !allRed && overview.prices.length > 0) {
      const sorted = [...overview.prices].filter(p => p.price > 0).sort((a, b) => b.change24h - a.change24h);
      const best = sorted[0];
      if (best && best.change24h > 0) {
        // Only LONG on positive momentum asset
        const leverage = overview.fearGreed.value < 20 ? 15 : overview.fearGreed.value < 40 ? 20 : 25;
        const collateral = Math.min(balance * 0.2, 300);
        const entry = best.price;
        const sl = entry * 0.985;
        const tp1 = entry * 1.02;
        const tp2 = entry * 1.04;
        const liq = entry * (1 - 1 / leverage);
        const conf = Math.max(20, Math.min(70, 40 + best.change24h * 5));

        topPick = {
          pair: best.pair,
          direction: 'LONG',
          entry,
          stopLoss: Math.round(sl * 100) / 100,
          takeProfit1: Math.round(tp1 * 100) / 100,
          takeProfit2: Math.round(tp2 * 100) / 100,
          leverage,
          collateral: Math.round(collateral * 100) / 100,
          liquidationPrice: Math.round(liq * 100) / 100,
          confidence: Math.round(conf),
          reason: 'Momentum +' + best.change24h.toFixed(2) + '% 24h | F&G: ' + overview.fearGreed.value,
        };
      }
    }
    // If allRed or noTradeZone: topPick stays null -> dashboard shows ESPERAR

    return NextResponse.json({
      overview,
      analyses: ranked,
      session,
      macroRisk,
      noTradeZone,
      allRed,
      topPick,
      rules: RISK_RULES,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
