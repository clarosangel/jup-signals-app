// EMA calculation engine
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EMAResult {
  emaShort: number;
  emaLong: number;
  ema20: number;  // kept for backward compat
  ema200: number; // kept for backward compat
  price: number;
  signal: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NEUTRAL';
  priceVsEMA20: 'ABOVE' | 'BELOW';
  priceVsEMA200: 'ABOVE' | 'BELOW';
  strength: number; // 0-100 signal strength
  recommendation: 'STRONG_LONG' | 'LONG' | 'WAIT' | 'SHORT' | 'STRONG_SHORT';
  mode: 'EMA_20_200' | 'EMA_9_21'; // which EMA pair produced this
  avgVolume: number;
  lastVolume: number;
  volumeConfirm: boolean;
}

export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // SMA for first period
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
  }
  ema.push(sum / Math.min(period, prices.length));

  // EMA calculation
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }

  return ema;
}

// Primary analysis: tries EMA 20/200 first, falls back to EMA 9/21
export function analyzeEMA(candles: Candle[]): EMAResult | null {
  // Try EMA 20/200 first (needs 200+ candles)
  if (candles.length >= 200) {
    const result = analyzeEMAPair(candles, 20, 200, 'EMA_20_200');
    if (result) return result;
  }

  // Fallback to EMA 9/21 (needs 21+ candles)
  if (candles.length >= 30) {
    return analyzeEMAPair(candles, 9, 21, 'EMA_9_21');
  }

  return null;
}

function analyzeEMAPair(
  candles: Candle[],
  shortPeriod: number,
  longPeriod: number,
  mode: 'EMA_20_200' | 'EMA_9_21'
): EMAResult | null {
  if (candles.length < longPeriod) return null;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const emaShortArray = calculateEMA(closes, shortPeriod);
  const emaLongArray = calculateEMA(closes, longPeriod);

  const emaShort = emaShortArray[emaShortArray.length - 1];
  const emaLong = emaLongArray[emaLongArray.length - 1];
  const price = closes[closes.length - 1];

  // Volume analysis
  const recentVols = volumes.slice(-30).filter(v => v > 0);
  const avgVolume = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const lastVolume = volumes[volumes.length - 1] || 0;
  const volumeConfirm = avgVolume > 0 ? lastVolume > avgVolume * 0.8 : true; // confirm if volume >= 80% of avg

  // Determine cross
  let signal: EMAResult['signal'] = 'NEUTRAL';
  if (emaShort > emaLong) signal = 'GOLDEN_CROSS';
  if (emaShort < emaLong) signal = 'DEATH_CROSS';

  const priceVsShort = price > emaShort ? 'ABOVE' : 'BELOW';
  const priceVsLong = price > emaLong ? 'ABOVE' : 'BELOW';

  // Signal strength 0-100
  let strength = 50;

  // Cross direction
  if (signal === 'GOLDEN_CROSS') strength += 15;
  if (signal === 'DEATH_CROSS') strength -= 15;

  // Price vs EMAs
  if (priceVsShort === 'ABOVE') strength += 10;
  else strength -= 10;
  if (priceVsLong === 'ABOVE') strength += 10;
  else strength -= 10;

  // EMA spread indicates trend strength
  const spread = Math.abs(emaShort - emaLong) / emaLong * 100;
  if (signal === 'GOLDEN_CROSS') strength += Math.min(spread * 5, 15);
  if (signal === 'DEATH_CROSS') strength -= Math.min(spread * 5, 15);

  // Volume confirmation bonus/penalty
  if (!volumeConfirm) {
    // Low volume = less confidence, pull toward 50
    strength = strength > 50 ? strength - 10 : strength + 10;
  }

  // EMA 9/21 is a faster, noisier signal — slightly reduce extremes
  if (mode === 'EMA_9_21') {
    strength = Math.round(50 + (strength - 50) * 0.85);
  }

  strength = Math.max(0, Math.min(100, strength));

  let recommendation: EMAResult['recommendation'] = 'WAIT';
  if (strength >= 80) recommendation = 'STRONG_LONG';
  else if (strength >= 65) recommendation = 'LONG';
  else if (strength <= 20) recommendation = 'STRONG_SHORT';
  else if (strength <= 35) recommendation = 'SHORT';

  return {
    emaShort,
    emaLong,
    ema20: emaShort,
    ema200: emaLong,
    price,
    signal,
    priceVsEMA20: priceVsShort,
    priceVsEMA200: priceVsLong,
    strength,
    recommendation,
    mode,
    avgVolume,
    lastVolume,
    volumeConfirm,
  };
}

export interface TradeSignal {
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  leverage: number;
  collateral: number;
  liquidationPrice: number;
  riskReward: number;
  confidence: number;
}

export function generateSignal(
  pair: string,
  analysis: EMAResult,
  balance: number
): TradeSignal | null {
  if (analysis.recommendation === 'WAIT') return null;

  const isLong = analysis.recommendation === 'STRONG_LONG' || analysis.recommendation === 'LONG';
  const price = analysis.price;

  // Leverage based on confidence (25x recommended max)
  const leverage = analysis.strength >= 80 ? 25 : analysis.strength >= 65 ? 20 : 15;

  // Max 20% of balance per trade
  const collateral = Math.min(balance * 0.2, 300);

  // IMPROVED R:R — SL at -1.5%, TP1 at +2%, TP2 at +4%
  const slPercent = 0.015;
  const tp1Percent = 0.02;
  const tp2Percent = 0.04;

  const stopLoss = isLong ? price * (1 - slPercent) : price * (1 + slPercent);
  const takeProfit1 = isLong ? price * (1 + tp1Percent) : price * (1 - tp1Percent);
  const takeProfit2 = isLong ? price * (1 + tp2Percent) : price * (1 - tp2Percent);

  // Liquidation price
  const liqDistance = 1 / leverage;
  const liquidationPrice = isLong
    ? price * (1 - liqDistance)
    : price * (1 + liqDistance);

  const riskReward = tp2Percent / slPercent; // 0.04/0.015 = 2.67

  return {
    pair,
    direction: isLong ? 'LONG' : 'SHORT',
    entry: price,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit1: Math.round(takeProfit1 * 100) / 100,
    takeProfit2: Math.round(takeProfit2 * 100) / 100,
    leverage,
    collateral: Math.round(collateral * 100) / 100,
    liquidationPrice: Math.round(liquidationPrice * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    confidence: analysis.strength,
  };
}
