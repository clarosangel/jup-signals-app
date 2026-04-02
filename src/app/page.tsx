'use client';

import { useState, useEffect, useCallback } from 'react';
import { RISK_RULES } from '@/lib/types';

interface TopPick {
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
    ema: {
      ema20: number;
      ema200: number;
      price: number;
      signal: string;
      priceVsEMA20: string;
      priceVsEMA200: string;
      strength: number;
      recommendation: string;
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
  session: string;
  macroRisk: string;
  noTradeZone: boolean;
  topPick: TopPick | null;
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

  const tp = data?.topPick;

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
              <p className="text-xs text-gray-500">Sesión</p>
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

        {/* ====== TOP PICK RECOMMENDATION BOX ====== */}
        {data?.noTradeZone ? (
          <div className="bg-red-950/40 border-2 border-red-500 rounded-2xl p-6 text-center">
            <p className="text-red-400 text-4xl font-black mb-2 animate-pulse">NO TRADE ZONE</p>
            <p className="text-red-300 text-lg">Fear & Greed en extremo ({data.overview.fearGreed.value}/100). No abrir posiciones.</p>
          </div>
        ) : tp ? (
          <div className={`rounded-2xl p-6 border-2 ${tp.direction === 'LONG' ? 'bg-green-950/30 border-green-500' : 'bg-red-950/30 border-red-500'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${tp.direction === 'LONG' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                  RECOMENDACIÓN
                </span>
                <span className="text-gray-400 text-sm">{tp.reason}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Confianza</p>
                <p className={`text-lg font-bold ${tp.confidence >= 60 ? 'text-green-400' : tp.confidence >= 40 ? 'text-yellow-400' : 'text-orange-400'}`}>{tp.confidence}%</p>
              </div>
            </div>
            <div className="flex items-center gap-6 mb-5">
              <div>
                <p className={`text-5xl font-black ${tp.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                  {tp.pair}
                </p>
              </div>
              <div>
                <span className={`text-3xl font-black ${tp.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                  {tp.direction}
                </span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-500">Leverage</p>
                <p className="text-3xl font-black text-yellow-400">{tp.leverage}x</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Entry</p>
                <p className="text-lg font-bold text-white">${tp.entry.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Stop Loss</p>
                <p className="text-lg font-bold text-red-400">${tp.stopLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">TP1 (+1%)</p>
                <p className="text-lg font-bold text-green-400">${tp.takeProfit1.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">TP2 (+2%)</p>
                <p className="text-lg font-bold text-green-400">${tp.takeProfit2.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Collateral</p>
                <p className="text-lg font-bold text-blue-400">${tp.collateral}</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs text-gray-500">Liquidación</p>
                <p className="text-lg font-bold text-red-400">${tp.liquidationPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-xl font-bold">Sin señal clara — ESPERAR</p>
            <p className="text-gray-600 text-sm">No hay activos con señal suficiente para entrar</p>
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
            <p className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${totalPnl.toFixed(2)}</p>
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
            <div key={p.pair} className={`bg-gray-900 rounded-xl p-4 border ${tp && tp.pair === p.pair ? (tp.direction === 'LONG' ? 'border-green-500 ring-1 ring-green-500/30' : 'border-red-500 ring-1 ring-red-500/30') : 'border-gray-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold">{p.pair}</span>
                <div className="flex items-center gap-2">
                  {tp && tp.pair === p.pair && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${tp.direction === 'LONG' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                      TOP PICK
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${p.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.change24h >= 0 ? '+' : ''}{p.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold">${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500">Vol: ${(p.volume24h / 1e6).toFixed(1)}M</p>
            </div>
          ))}
        </div>

        {/* Signal Cards */}
        {data?.analyses && data.analyses.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3 text-gray-300">Análisis EMA Cross 20/200</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.analyses.map(a => (
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
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">EMA 20</span>
                          <span className="text-orange-400">${a.ema.ema20.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">EMA 200</span>
                          <span className="text-blue-400">${a.ema.ema200.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Cross</span>
                          <span className={a.ema.signal === 'GOLDEN_CROSS' ? 'text-green-400' : a.ema.signal === 'DEATH_CROSS' ? 'text-red-400' : 'text-gray-400'}>
                            {a.ema.signal === 'GOLDEN_CROSS' ? 'Golden' : a.ema.signal === 'DEATH_CROSS' ? 'Death' : 'Neutral'}
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Signal Strength</span>
                          <span>{a.ema.strength.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${a.ema.strength >= 70 ? 'bg-green-500' : a.ema.strength >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${a.ema.strength}%` }}
                          />
                        </div>
                      </div>
                      {a.signal && (
                        <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                          <p className="text-xs font-bold text-green-400 mb-2">SEÑAL ACTIVA</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-gray-500">Entry:</span><span className="text-right">${a.signal.entry.toFixed(2)}</span>
                            <span className="text-gray-500">SL:</span><span className="text-right text-red-400">${a.signal.stopLoss.toFixed(2)}</span>
                            <span className="text-gray-500">TP1:</span><span className="text-right text-green-400">${a.signal.takeProfit1.toFixed(2)}</span>
                            <span className="text-gray-500">TP2:</span><span className="text-right text-green-400">${a.signal.takeProfit2.toFixed(2)}</span>
                            <span className="text-gray-500">Leverage:</span><span className="text-right text-yellow-400">{a.signal.leverage}x</span>
                            <span className="text-gray-500">Liq:</span><span className="text-right text-red-400">${a.signal.liquidationPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Insuficientes datos para EMA200</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
              { label: 'TP1 / TP2', value: '+1% / +2%', color: 'text-green-400' },
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
                    <td className="py-2 px-3">${t.entry.toLocaleString()}</td>
                    <td className="py-2 px-3">{t.exit ? `$${t.exit.toLocaleString()}` : '—'}</td>
                    <td className="py-2 px-3 text-yellow-400">{t.leverage}x</td>
                    <td className="py-2 px-3">${t.collateral.toFixed(2)}</td>
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
          JUP Signals v1.0 — Experimental Trading Dashboard — Not Financial Advice
        </footer>
      </main>
    </div>
  );
}
