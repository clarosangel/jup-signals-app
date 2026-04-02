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
  ema20: number;
  ema200: number;
  price: number;
  signal: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NEUTRAL';
  priceVsEMA20: 'ABOVE' | 'BELOW';
  priceVsEMA200: 'ABOVE' | 'BELOW';
  strength: number; // 0-100 signal strength
  recommendation: 'STRONG_LONG' | 'LONG' | 'WAIT' | 'SHORT' | 'STRONG_SHORT';
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

export function analyzeEMA(candles: Candle[]): EMAResult | null {
  if (candles.length < 200) return null;

  const closes = candles.map(c => c.close);
  const ema20Array = calculateEMA(closes, 20);
  const ema200Array = calculateEMA(closes, 200);

  const ema20 = ema20Array[ema20Array.length - 1];
  const ema200 = ema200Array[ema200Array.length - 1];
  const price = closes[closes.length - 1];

  // Determine cross
  const prevEma20 = ema20Array.length > 1 ? ema20Array[ema20Array.length - 2] : ema20;
  const prevEma200 = ema200Array.length > 1 ? ema200Array[ema200Array.length - 2] : ema200;

  let signal: EMAResult['signal'] = 'NEUTRAL';
  if (ema20 > ema200) signal = 'GOLDEN_CROSS';
  if (ema20 < ema200) signal = 'DEATH_CROSS';

  const priceVsEMA20 = price > ema20 ? 'ABOVE' : 'BELOW';
  const priceVsEMA200 = price > ema200 ? 'ABOVE' : 'BELOW';

  // Signal strength 0-100
  let strength = 50;
  if (signal === 'GOLDEN_CROSS') strength += 15;
  if (signal === 'DEATH_CROSS') strength -= 15;
  if (priceVsEMA20 === 'ABOVE') strength += 10;
  else strength -= 10;
  if (priceVsEMA200 === 'ABOVE') strength += 10;
  else strength -= 10;

  // EMA spread indicates trend strength
  const spread = Math.abs(ema20 - ema200) / ema200 * 100;
  if (signal === 'GOLDEN_CROSS') strength += Math.min(spread * 5, 15);
  if (signal === 'DEATH_CROSS') strength -= Math.min(spread * 5, 15);

  strength = Math.max(0, Math.min(100, strength));

  let recommendation: EMAResult['recommendation'] = 'WAIT';
  if (strength >= 80) recommendation = 'STRONG_LONG';
  else if (strength >= 65) recommendation = 'LONG';
  else if (strength <= 20) recommendation = 'STRONG_SHORT';
  else if (strength <= 35) recommendation = 'SHORT';

  return { ema20, ema200, price, signal, priceVsEMA20, priceVsEMA200, strength, recommendation };
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

  // SL at -1.5% for longs, +1.5% for shorts
  const slPercent = 0.015;
  const stopLoss = isLong ? price * (1 - slPercent) : price * (1 + slPercent);

  // TP1 at +1%, TP2 at +2%
  const takeProfit1 = isLong ? price * 1.01 : price * 0.99;
  const takeProfit2 = isLong ? price * 1.02 : price * 0.98;

  // Liquidation price
  const liqDistance = 1 / leverage;
  const liquidationPrice = isLong
    ? price * (1 - liqDistance)
    : price * (1 + liqDistance);

  const riskReward = 0.02 / slPercent; // ~1.33

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

