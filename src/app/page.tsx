'use client';

import { useState, useEffect, useCallback } from 'react';
import { RISK_RULES } from '@/lib/types';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  overview: {
    prices: Array<{ pair: string; price: number; change24h: number; volume24h: number }>;
    fearGreed: { value: number; classification: string };
    btcDominance: number;
    timestamp: string;
  };
  analyses: Array<{
    pair: string;
    candles?: CandleData[];
    ema: {
      ema20: number;
      ema200: number;
      price: number;
      signal: string;
      priceVsEMA20: string;
      priceVsEMA200: string;
      strength: number;
      recommendation: string;
      mode?: string;
      volumeConfirm?: boolean;
    } | null;
    signal: {
      pair: string;
      direction: string;
      entry: number;
      stopLoss: number;
      takeProfit1: number;
      takeProfit2: number;
      leverage: number;
      collateral: number;
      liquidationPrice: number;
      riskReward: number;
      confidence: number;
    } | null;
  }>;
  topPick: {
    pair: string;
    direction: string;
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    leverage: number;
    collateral: number;
    liquidationPrice: number;
    confidence: number;
    reason: string;
  } | null;
  session: string;
  macroRisk: string;
  noTradeZone: boolean;
  allRed?: boolean;
  timestamp: string;
}

interface Trade {
  id: string;
  pair: string;
  direction: string;
  entry: number;
  exit: number | null;
  pnl: number | null;
  leverage: number;
  collateral: number;
  status: string;
  time: string;
}

// Convert raw strength (0=bearish, 100=bullish) to directional confidence
function getDirectionalConfidence(strength: number, recommendation: string): number {
  const isShort = recommendation === 'STRONG_SHORT' || recommendation === 'SHORT';
  return isShort ? 100 - strength : strength;
}

// Calculate EMA from close prices (client-side for chart)
function calcEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const ema: number[] = [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema.push(sum / period);
  for (let i = period; i < closes.length; i++) {
    ema.push((closes[i] - ema[ema.length - 1]) * k + ema[ema.length - 1]);
  }
  return ema;
}
// Mini candlestick chart with EMA lines
function CandleChart({ candles, ema20Val, ema200Val, pair }: { candles: CandleData[]; ema20Val: number; ema200Val: number; pair: string }) {
  if (!candles || candles.length < 5) return <p className="text-gray-600 text-xs">Sin datos de velas</p>;

  const W = 400, H = 180, PAD = { top: 10, bottom: 25, left: 50, right: 10 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allHighs = candles.map(c => c.high);
  const allLows = candles.map(c => c.low);
  let minP = Math.min(...allLows, ema20Val, ema200Val);
  let maxP = Math.max(...allHighs, ema20Val, ema200Val);
  const range = maxP - minP || 1;
  minP -= range * 0.05;
  maxP += range * 0.05;
  const pRange = maxP - minP;

  const yScale = (price: number) => PAD.top + chartH - ((price - minP) / pRange) * chartH;
  const candleW = Math.max(2, (chartW / candles.length) * 0.6);
  const gap = chartW / candles.length;

  // Calculate EMAs from candle closes for the chart line
  const closes = candles.map(c => c.close);
  const ema20Arr = calcEMA(closes, Math.min(20, Math.floor(closes.length * 0.4)));
  const ema200Arr = calcEMA(closes, Math.min(closes.length - 1, Math.floor(closes.length * 0.8)));

  const makeLinePath = (values: number[], offset: number) => {
    if (values.length < 2) return '';
    return values.map((v, i) => {
      const x = PAD.left + (i + offset) * gap + gap / 2;
      const y = yScale(v);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const ema20Offset = candles.length - ema20Arr.length;
  const ema200Offset = candles.length - ema200Arr.length;

  // Price grid lines
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const price = minP + (pRange * i) / gridCount;
    return { y: yScale(price), price };
  });

  // Time labels
  const timeLabels: { x: number; label: string }[] = [];
  const step = Math.max(1, Math.floor(candles.length / 5));
  for (let i = 0; i < candles.length; i += step) {
    const d = new Date(candles[i].time);
    timeLabels.push({
      x: PAD.left + i * gap + gap / 2,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
    });
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} fill="#111827" rx="4" />

        {/* Grid lines & price labels */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="#1f2937" strokeWidth="0.5" />
            <text x={PAD.left - 4} y={g.y + 3} fill="#6b7280" fontSize="7" textAnchor="end">
              {pair === 'WBTC' ? `${(g.price / 1000).toFixed(1)}k` : g.price.toFixed(pair === 'SOL' ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Time labels */}
        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 5} fill="#6b7280" fontSize="6" textAnchor="middle">{t.label}</text>
        ))}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x = PAD.left + i * gap + gap / 2;
          const isGreen = c.close >= c.open;
          const color = isGreen ? '#22c55e' : '#ef4444';
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBot = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(0.5, bodyBot - bodyTop);
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={x} y1={yScale(c.high)} x2={x} y2={yScale(c.low)} stroke={color} strokeWidth="0.5" />
              {/* Body */}
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="0.3" />
            </g>
          );
        })}

        {/* EMA 200 line (blue) */}
        {ema200Arr.length > 1 && (
          <path d={makeLinePath(ema200Arr, ema200Offset)} fill="none" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3,2" opacity="0.8" />
        )}

        {/* EMA 20 line (orange) */}
        {ema20Arr.length > 1 && (
          <path d={makeLinePath(ema20Arr, ema20Offset)} fill="none" stroke="#f97316" strokeWidth="1.2" opacity="0.9" />
        )}

        {/* Legend */}
        <line x1={PAD.left + 5} y1={PAD.top + 6} x2={PAD.left + 18} y2={PAD.top + 6} stroke="#f97316" strokeWidth="1.5" />
        <text x={PAD.left + 21} y={PAD.top + 9} fill="#f97316" fontSize="6.5" fontWeight="bold">EMA 20</text>
        <line x1={PAD.left + 55} y1={PAD.top + 6} x2={PAD.left + 68} y2={PAD.top + 6} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,2" />
        <text x={PAD.left + 71} y={PAD.top + 9} fill="#3b82f6" fontSize="6.5" fontWeight="bold">EMA 200</text>
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trades] = useState<Trade[]>([
    { id: '1', pair: 'SOL', direction: 'LONG', entry: 83.02, exit: 83.30, pnl: 32.56, leverage: 48, collateral: 200.07, status: 'CLOSED', time: '31-Mar 19:31' },
    { id: '2', pair: 'ETH', direction: 'LONG', entry: 2128.54, exit: 2150.00, pnl: 63.99, leverage: 25, collateral: 200.64, status: 'CLOSED', time: '01-Abr 10:05' },
    { id: '3', pair: 'ETH', direction: 'LONG', entry: 2141.60, exit: 2150.99, pnl: 83.36, leverage: 48, collateral: 405.82, status: 'CLOSED', time: '01-Abr 16:42' },
  ]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = trades.length > 0
    ? (trades.filter(t => (t.pnl || 0) > 0).length / trades.length * 100)
    : 0;

  const getFearColor = (value: number) => {
    if (value <= 20) return 'text-red-400';
    if (value <= 40) return 'text-orange-400';
    if (value <= 60) return 'text-yellow-300';
    return 'text-green-400';
  };

  const getSignalColor = (rec: string) => {
    if (rec === 'STRONG_LONG') return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (rec === 'LONG') return 'bg-green-500/10 text-green-300 border-green-500/30';
    if (rec === 'STRONG_SHORT') return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (rec === 'SHORT') return 'bg-red-500/10 text-red-300 border-red-500/30';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Cargando datos de mercado...</p>
        </div>
      </div>
    );
  }

  const tp1Pct = (RISK_RULES.takeProfit1Percent * 100).toFixed(0);
  const tp2Pct = (RISK_RULES.takeProfit2Percent * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center font-bold text-black text-lg">J</div>
            <div>
              <h1 className="text-xl font-bold">JUP Signals</h1>
              <p className="text-xs text-gray-500">Perps Trading Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Sesion</p>
              <p className="text-sm font-semibold text-blue-400">{data?.session || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Refresh</p>
              <p className="text-sm text-gray-300">{lastRefresh.toLocaleTimeString()}</p>
            </div>
            <button onClick={fetchData} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Refresh</button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-sm ${autoRefresh ? 'bg-green-600' : 'bg-gray-800'}`}
            >
              Auto {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top Recommendation Box */}
        {data?.topPick ? (
          <div className={`rounded-xl p-6 border-2 ${data.topPick.direction === 'SHORT' ? 'border-red-500 bg-red-950/20' : 'border-green-500 bg-green-950/20'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${data.topPick.direction === 'SHORT' ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>RECOMENDACION</span>
                <span className="text-sm text-gray-400">{data.topPick.reason}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Confianza</p>
                <p className={`text-xl font-bold ${
                  getDirectionalConfidence(data.topPick.confidence, data.topPick.direction === 'SHORT' ? 'STRONG_SHORT' : 'STRONG_LONG') >= 70
                    ? (data.topPick.direction === 'SHORT' ? 'text-red-400' : 'text-green-400')
                    : 'text-yellow-400'
                }`}>
                  {getDirectionalConfidence(data.topPick.confidence, data.topPick.direction === 'SHORT' ? 'STRONG_SHORT' : 'STRONG_LONG')}%
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold">{data.topPick.pair}</span>
                <span className={`text-3xl font-bold ${data.topPick.direction === 'SHORT' ? 'text-red-400' : 'text-green-400'}`}>{data.topPick.direction}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Leverage</p>
                <p className="text-3xl font-bold text-yellow-400">{data.topPick.leverage}x</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Entry', value: `$${data.topPick.entry.toFixed(2)}`, color: 'text-white' },
                { label: 'Stop Loss', value: `$${data.topPick.stopLoss.toFixed(2)}`, color: 'text-red-400' },
                { label: `TP1 (+${tp1Pct}%)`, value: `$${data.topPick.takeProfit1.toFixed(2)}`, color: 'text-green-400' },
                { label: `TP2 (+${tp2Pct}%)`, value: `$${data.topPick.takeProfit2.toFixed(2)}`, color: 'text-blue-400' },
                { label: 'Collateral', value: `$${data.topPick.collateral}`, color: 'text-orange-400' },
                { label: 'Liquidacion', value: `$${data.topPick.liquidationPrice.toFixed(2)}`, color: 'text-red-400' },
              ].map(item => (
                <div key={item.label} className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-6 border-2 border-yellow-500/50 bg-yellow-950/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏸️</span>
              <div>
                <p className="text-xl font-bold text-yellow-400">Sin senal clara — ESPERAR</p>
                <p className="text-sm text-gray-400">
                  {data?.allRed ? 'Todos los activos en rojo — mercado en panico' : data?.noTradeZone ? 'Fear & Greed extremo — no trade zone' : 'No hay confluencia tecnica suficiente'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Macro Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Fear & Greed Index</p>
            <p className={`text-3xl font-bold ${getFearColor(data?.overview.fearGreed.value || 50)}`}>
              {data?.overview.fearGreed.value || '—'}
            </p>
            <p className="text-sm text-gray-400">{data?.overview.fearGreed.classification}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">BTC Dominance</p>
            <p className="text-3xl font-bold text-orange-400">{(data?.overview.btcDominance || 0).toFixed(1)}%</p>
            <p className="text-sm text-gray-400">{(data?.overview.btcDominance || 0) > 55 ? 'BTC Season' : 'Alt Season posible'}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">P&L Total</p>
            <p className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>$${totalPnl.toFixed(2)}</p>
            <p className="text-sm text-gray-400">{trades.length} trades | WR: {winRate.toFixed(0)}%</p>
          </div>
          <div className={`bg-gray-900 rounded-xl p-4 border ${data?.noTradeZone ? 'border-red-500 bg-red-950/30' : 'border-gray-800'}`}>
            <p className="text-xs text-gray-500 mb-1">Macro Risk</p>
            <p className={`text-2xl font-bold ${data?.macroRisk?.includes('EXTREME') ? 'text-red-400' : data?.macroRisk?.includes('FEAR') ? 'text-orange-400' : 'text-green-400'}`}>
              {data?.macroRisk?.replace('_', ' ') || '—'}
            </p>
            {data?.noTradeZone && <p className="text-sm text-red-400 font-semibold animate-pulse">NO TRADE ZONE</p>}
          </div>
        </div>

        {/* Price Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.overview.prices.map(p => (
            <div key={p.pair} className={`bg-gray-900 rounded-xl p-4 border ${data?.topPick?.pair === p.pair ? 'border-red-500/60' : 'border-gray-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{p.pair}</span>
                  {data?.topPick?.pair === p.pair && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">TOP PICK</span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${p.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.change24h >= 0 ? '+' : ''}{p.change24h.toFixed(2)}%
                </span>
              </div>
              <p className="text-2xl font-bold">$${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500">Vol: $${(p.volume24h / 1e6).toFixed(1)}M</p>
            </div>
          ))}
        </div>

        {/* Signal Cards */}
        <div>
          <h2 className="text-lg font-bold mb-3 text-gray-300">Analisis EMA Cross 20/200</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data?.analyses.map(a => {
              const isShort = a.ema?.recommendation === 'STRONG_SHORT' || a.ema?.recommendation === 'SHORT';
              const dirConfidence = a.ema ? getDirectionalConfidence(a.ema.strength, a.ema.recommendation) : 0;
              return (
                <div key={a.pair} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold">{a.pair}</span>
                    {a.ema && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getSignalColor(a.ema.recommendation)}`}>
                        {a.ema.recommendation.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {a.ema ? (
                    <>
                      {/* Candlestick Chart with EMAs */}
                      {a.candles && a.candles.length > 5 && (
                        <div className="mb-3 bg-gray-950 rounded-lg p-2 border border-gray-800">
                          <CandleChart candles={a.candles} ema20Val={a.ema.ema20} ema200Val={a.ema.ema200} pair={a.pair} />
                        </div>
                      )}
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">EMA 20</span>
                          <span className="text-orange-400">$${a.ema.ema20.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">EMA 200</span>
                          <span className="text-blue-400">$${a.ema.ema200.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Cross</span>
                          <span className={a.ema.signal === 'GOLDEN_CROSS' ? 'text-green-400' : a.ema.signal === 'DEATH_CROSS' ? 'text-red-400' : 'text-gray-400'}>
                            {a.ema.signal === 'GOLDEN_CROSS' ? 'Golden' : a.ema.signal === 'DEATH_CROSS' ? 'Death' : 'Neutral'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">vs EMA20</span>
                          <span className={a.ema.priceVsEMA20 === 'ABOVE' ? 'text-green-400' : 'text-red-400'}>{a.ema.priceVsEMA20}</span>
                        </div>
                        {a.ema.mode && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Modo</span>
                            <span className="text-purple-400">{a.ema.mode.replace('_', ' ')}</span>
                          </div>
                        )}
                        {a.ema.volumeConfirm !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Volumen</span>
                            <span className={a.ema.volumeConfirm ? 'text-green-400' : 'text-yellow-400'}>
                              {a.ema.volumeConfirm ? 'Confirmado' : 'Bajo'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Confianza Direccional</span>
                          <span>{dirConfidence.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              dirConfidence >= 70
                                ? (isShort ? 'bg-red-500' : 'bg-green-500')
                                : dirConfidence >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-500'
                            }`}
                            style={{ width: `${dirConfidence}%` }}
                          />
                        </div>
                      </div>
                      {a.signal && (
                        <div className={`mt-3 p-3 rounded-lg border ${isShort ? 'bg-red-950/30 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
                          <p className={`text-xs font-bold mb-2 ${isShort ? 'text-red-400' : 'text-green-400'}`}>SENAL ACTIVA - {a.signal.direction}</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-gray-500">Entry:</span><span className="text-right">$${a.signal.entry.toFixed(2)}</span>
                            <span className="text-gray-500">SL:</span><span className="text-right text-red-400">$${a.signal.stopLoss.toFixed(2)}</span>
                            <span className="text-gray-500">TP1:</span><span className="text-right text-green-400">$${a.signal.takeProfit1.toFixed(2)}</span>
                            <span className="text-gray-500">TP2:</span><span className="text-right text-green-400">$${a.signal.takeProfit2.toFixed(2)}</span>
                            <span className="text-gray-500">Leverage:</span><span className="text-right text-yellow-400">{a.signal.leverage}x</span>
                            <span className="text-gray-500">R:R:</span><span className="text-right">{a.signal.riskReward}:1</span>
                            <span className="text-gray-500">Liq:</span><span className="text-right text-red-400">$${a.signal.liquidationPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Insuficientes datos para EMA200</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Rules */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-bold mb-3 text-gray-300">Risk Management Rules</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Max Leverage', value: `${RISK_RULES.maxLeverage}x`, color: 'text-yellow-400' },
              { label: 'Max Collateral', value: `${RISK_RULES.maxCollateralPercent * 100}%`, color: 'text-blue-400' },
              { label: 'Stop Loss', value: `-${RISK_RULES.stopLossPercent * 100}%`, color: 'text-red-400' },
              { label: 'Max Daily Loss', value: `$${RISK_RULES.maxDailyLoss}`, color: 'text-red-400' },
              { label: 'Max Positions', value: `${RISK_RULES.maxSimultaneousPositions}`, color: 'text-purple-400' },
              { label: 'TP1 / TP2', value: `+${tp1Pct}% / +${tp2Pct}%`, color: 'text-green-400' },
              { label: 'Max Streak Loss', value: `${RISK_RULES.maxConsecutiveLosses}`, color: 'text-orange-400' },
              { label: 'Cooldown', value: `${RISK_RULES.cooldownMinutes}min`, color: 'text-cyan-400' },
            ].map(r => (
              <div key={r.label} className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">{r.label}</p>
                <p className={`${r.color} font-bold text-lg`}>{r.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-bold mb-3 text-gray-300">Historial de Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  {['Fecha', 'Par', 'Dir', 'Entry', 'Exit', 'Lev', 'Collateral', 'PnL', 'Status'].map(h => (
                    <th key={h} className="py-2 px-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-400">{t.time}</td>
                    <td className="py-2 px-3 font-semibold">{t.pair}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.direction === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3">$${t.entry.toLocaleString()}</td>
                    <td className="py-2 px-3">{t.exit ? `$${t.exit.toLocaleString()}` : '—'}</td>
                    <td className="py-2 px-3 text-yellow-400">{t.leverage}x</td>
                    <td className="py-2 px-3">$${t.collateral.toFixed(2)}</td>
                    <td className={`py-2 px-3 font-bold ${(t.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="text-center text-gray-600 text-xs py-4">
          JUP Signals v1.2 — Experimental Trading Dashboard — Not Financial Advice
        </footer>
      </main>
    </div>
  );
}
