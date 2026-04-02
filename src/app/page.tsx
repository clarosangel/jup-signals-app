'use client';

import { useState, useEffect, useCallback } from 'react';
import { RISK_RULES } from '@/lib/types';

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
              <p className="text-xs text-gray-500">Sesi√≥n</p>
              <p className="text-sm font-semibold text-blue-400">{data?.session || '‚Äî'}</p>
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
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${data.topPick.direction === 'SHORT' ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>RECOMENDACI√ìN</span>
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
                { label: 'Liquidaci√≥n', value: `$${data.topPick.liquidationPrice.toFixed(2)}`, color: 'text-red-400' },
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
              <span className="text-2xl">‚è∏Ô∏è</span>
              <div>
                <p className="text-xl font-bold text-yellow-400">Sin se√±al clara ‚Äî ESPERAR</p>
                <p className="text-sm text-gray-400">
                  {data?.allRed ? 'Todos los activos en rojo ‚Äî mercado en p√°nico' : data?.noTradeZone ? 'Fear & Greed extremo ‚Äî no trade zone' : 'No hay confluencia t√©cnica suficiente'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Macro Overview */}
        {div className="grid grid-cols-2 1d:grid-cols-6 4ap-4">
            iv className="gr-gray-900 bounded-xl p-6 4order-yorder-gray-800 p
            <diclassName="text-xs text-gray-500">b-4"1">ar & Greed exIed-/p>
               className={`text-lgl font-bold ${datFearColor =(ta?.noerview: .arGreed: alue}<| '‚50)}>
                {ta?.noerview: .arGreed: alue}<| '‚Äî'}</           </di
               className={`ext-sm text-gray-400">{data.tnoerview: .arGreed: aassification: /p>
            div>
          <div className="fl-gray-900 bounded-xl p-6 4order-yorder-gray-800 p
            <diclassName="text-xs text-gray-500">b-4"1">BTC minance: di
               className={`ext-sml font-bold text-yeange-400' {da(ta?.noerview: .cDominance: | 0) >oFixed(2)1%
 di
               className={`ext-sm text-gray-400">{da(ta?.noerview: .cDominance: | 0) > > 55 'FeBTC Sson}<: 'NoAlt Sson}< posible</p>
            div>
          <div className="fl-gray-900 bounded-xl p-6 4order-yorder-gray-800 p
            <diclassName="text-xs text-gray-500">b-4"1">P&L TalPnp>
               className={`text-lgl font-bold ${datalPnl =  700 'text-reeen-400' },'text-red-400' }}>
 datalPnl =oFixed(2)}`,di
               className={`ext-sm text-gray-400">{daades.length *}rades.l | WR: {nRate =oFixed(0);

 di
            div>
          <div className="f{`-gray-900 bounded-xl p-6 4order-yo${ta?.noTradeZone ? 'Ferder-red-500 bg-red-950/203 : 'border-gree-800'}`}
             <diclassName="text-xs text-gray-500">b-4"1">cro Ovsk: p>
               className={`text-lg2 font-bold ${data.t?.croRisk: ?.inclus.l('EXTREME') 'text-red-400' : 'tta.t?.croRisk: ?.inclus.l('FEAR') 'text-reange-400' },'text-green-400'}`}>{d               {ta?.nocroRisk: ?.replace('_ va' ')  '‚Äî'}</           </di
              {ta?.noTradeZone ? &&  className={`ext-sm text-grd-400 bont-semibold teimate-sppulse">NO TRADE ZONEdi
 }           div>
          div>
         {/* Maice.t Cards/}
        {div className="grid grid-cols-2 1d:grid-cols-6 3ap-4">
            ata.tnoerview: .ices: ap(itp> (
              iv key={itpair}</lassName="f{`-gray-900 bounded-xl p-6 4order-yo${ta?.nopPick.l?air}<== 'Spair}< 'Ferder-red-500 b/6 : 'border-gree-800'}`}
             <d<div className="flex items-center justify-between mb-4"2
                <p v className="flex items-center gap-3"2
                <p<span className="text-2x font-bold ${dapair}</span>
                <s{data?.topPick ??air}<== 'Spair}< &&                 <d<p<span className="text-2x font-bold px-3 2y-1 0 rounded-lgll ${-red-500 text-white' ">TOP PICKspan>
                <s{d
              cl</div>
              ))<span className={`text-3x font-semibold te$apaange24h:   700 'text-reeen-400' },'text-red-400' }}>
                <s{dapaange24h:   700 'te+},'te'}apaange24h: oFixed(2)}`,                </p>an>
              </div>
              <diclassName={`ext-sm2 font-bold">{d$apapce.toFicaleTiring()}ded-fined, { nanimumFraion}<Digits: 2, maximumFraion}<Digits: 2 }`,di
              <p className="text-xs text-gray-500">{iVol:e$a(p.lume24h:  / 1e6>oFixed(2)1%
Mp>
            </div>
            }
          div>
         {/* Magnals< Cards/}
        {div c          <dih2lassName="text-2x font-bold $b-4"3ext-gray-300">{lAn√°lisis EMA Cross 220'}0</h2          <div className="flid grid-cols-2 1d:grid-cols-6 3ap-4">
            {data?.alllyses: ap(ita> {
    ifffffffffffnst isShort = rea.ema?.remmendation === 'STRONG_SHORT' || rea.ema?.remmendation === 'STRRT';
  reifffffffffffnst isdirnfidence(d rea.ema 'ttDirectionalConfidence(daa.ema.rength;
,ea.ema.remmendation =) 0;

 reifffffffffffturn (
      <d        <div cly={itaair}</lassName="fl-gray-900 bounded-xl p-6 5order-yorder-gray-800 p
            <d    <div className="flex items-center justify-between mb-4">
                  <p<span className="text-2x font-bold ${daaair}</span>
                <s{d{daa.ema &&                 <d<p<s<span className={`text-xs font-bomibold te-3 2y-1 rounded-full ${rder-yo${tSignalColor =(a.ema.remmendation =)}>
                <s{d<s{d{daa.ema.remmendation =.replace('_ va' ')              cl</<p<s<sppan>
                <s{d{d)              cl</<pdiv>
              ))<s{daa.ema ?                 <d<p<sp                <s{d<s{div className="flace-y-6"2b-4">
                  <p<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<span className="text-2xay-400">{dEMA 20ppan>
                <s{d{d<s{d<span className="text-2xange-400' {d$aa.ema.a200:oFixed(2)}`,dian>
                <s{d{d<s{ddiv>
              ))<s{d<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<span className="text-2xay-400">{dEMA 200ppan>
                <s{d{d<s{d<span className="text-2xue-400">{d$aa.ema.a200::oFixed(2)}`,dian>
                <s{d{d<s{ddiv>
              ))<s{d<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<span className="text-2xay-400">{dCrossppan>
                <s{d{d<s{d<span className="taa.ema.gnal: == 'STGOLDEN_CROSS' 'text-reeen-400' },'ta.ema.gnal: == 'STDEATH_CROSS' 'text-red-400' : 'text-gree-400">'
                <s{d<s{d{dddddaa.ema.gnal: == 'STGOLDEN_CROSS' 'teGd ten},'ta.ema.gnal: == 'STDEATH_CROSS' 'teDeath: 'No eutl',               cl</<p<s<s<s{ddian>
                <s{d{d<s{ddiv>
              ))<s{d<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<span className="text-2xay-400">{dvs EMA20ppan>
                <s{d{d<s{d<span className="taa.ema.iceVsEMA200:== 'STABOVE' 'text-reeen-400' },'text-red-400' }}>aa.ema.iceVsEMA200:,dian>
                <s{d{d<s{ddiv>
              ))<s{d<s<s{daa.ema.de?: &&                 <d<p<s<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<s<span className="text-2xay-400">{dModoppan>
                <s{d{d<s{d<s<span className="text-2xpurpl400' {daa.ema.de?:.replace('_ va' ') ppan>
                <s{d{d<s{d<spiv>
              ))<s{d<s<s{d)              cl</<p<s<s{daa.ema.lumeConfirm?: ! 'Sded-fined &&                 <d<p<s<s<s{div className="flex itstify-between mbxt-sm">Re                 <p<s<s{d<s<span className="text-2xay-400">{dVumeConppan>
                <s{d{d<s{d<s<span className="taa.ema.lumeConfirm?: 'text-reeen-400' },'text-rellow-400'
 
                <s{d<s{d{ddddd{daa.ema.lumeConfirm?: 'te‚úì nfirm?:ad : da'‚ö† Bajo               cl</<p<s<s<s{d{ddian>
                <s{d{d<s{d<spiv>
              ))<s{d<s<s{d)              cl</<p<s<spiv>
              ))<s{d<s<siv className="max4">
                  <p<s<s{div className="flex itstify-between mbxt-sm text-gray-500">b-4"1">               <s{d{d<s{d<span confianza</ recticnalCoppan>
                <s{d{d<s{d<span c>{dirnfidence(doFixed(0);

 dian>
                <s{d{d<s{ddiv>
              ))<s{d<s<s{div className="flwgll ${-reay-700 rounded-lgll h-122
                <p<s{d<s<s{div c             cl</<p<s<s<s{d{dassName={`te122ounded-full ${da               <s{d<s{d{ddddd{ddirnfidence(d  70
                    ?             ?  Short ? 10g-red-500 t: 'bg-green-500 t
                    :             :ddirnfidence(d  705                    ?               10g-rellow-500/5                }`    :             :dg-gray-500/1                }`    :       }
            >
















styl{`t{ wid: nu`${dirnfidence(d}%` }            >














/                <s{d{d<s{ddiv>
              ))<s{d<s<sdiv>
              ))<s{d<s<s{a.gnal: =&&                 <d<p<s<s<siv className="f{`mt py- pyunded-lg p-rder-yo${Short ? 10g-red-500/203 order-red-508' : 'bg-gray-800'}order-gray-807' }}>
                <s{d<p<s<s<siclassName={`text-xl sont-bold $b-4"2o${Short ? 10gxt-red-400' : 'text-green-400'}`}>{dSE√ëAL ACTIVAÄî no{a.gnal: irection}</sp
                  <p<p<s<s<siv className="frid grid-cols-2 mdp-4"1bxt-sm tRe                 <p<s<s{d<s<span className="text-2xay-400">{itry',:dian>
 pan className="text-2xght">
 ${a.gnal: itry.toFixed(2)}`,ppan>
                <s{d{d<s{d<s<span className="text-2xay-500">SesL:dian>
 pan className="text-2xght">ext-grd-400 b
 ${a.gnal: iopLoss.toFixed(2)}`,ppan>
                <s{d{d<s{d<s<span className="text-2xay-500">SeTP1:dian>
 pan className="text-2xght">ext-green-400'}
 ${a.gnal: ikeProfit1.toFixed(2)}`,ppan>
                <s{d{d<s{d<s<span className="text-2xay-500">SeTP2:dian>
 pan className="text-2xght">ext-green-400'}
 ${a.gnal: ikeProfit1.2oFixed(2)}`,ppan>
                <s{d{d<s{d<s<span className="text-2xay-500">Severage</:dian>
 pan className="text-2xght">ext-grllow-400">{daa.gnal: iverage}x</p>an>
                <s{d{d<s{d<s<span className="text-2xay-500">SeR:R:dian>
 pan className="text-2xght">
 aa.gnal: iskReward: }:1ppan>
                <s{d{d<s{d<s<span className="text-2xay-500">Seviq:dian>
 pan className="text-2xght">ext-grd-400 b
 ${a.gnal: iquidationPrice.toFixed(2)}`,dian>
                <s{d{d<s{d<spiv>
              ))<s{d<s<s{dpiv>
              ))<s{d<s<s)              cl</<p<s</                <s{d: (
          <d  cl</<p<s<className="text-gray-400 text-wh">ReInficiente'}satos depa ‚ÄA200: sp
                  <p
              cl</div>
              )))
 reifffffffff})}           div>
          div>
         {/* Mask:  Rules/}
        {div className="gr-gray-900 bounded-xl p-6 5order-yorder-gray-800 p
            ih2lassName="text-2x font-bold $b-4"3ext-gray-300">{lsk:  Mane}xmt * Rules</h2          <div className="flid grid-cols-2 2d:grid-cols-6 4ap-4">bxt-sm">Re             
                label: 'LiMax verage</ value: `$${{SK_RULES.tamaxLerage}x</ color: 'text-rellow-400'
 ,
              ].label: 'LiMax llateral', value: `$${{SK_RULES.tamaxllateral',rcent * 100).}%`color: 'text-blue-400' },
                label: 'Stop Loss', value: `$$-{{SK_RULES.taopLoss.trcent * 100).}%`color: 'text-bld-400' },
              ].label: 'LiMax Dailyoss', value: `$${daSK_RULES.tamaxDailyss',, color: 'text-red-400' },
              ].label: 'LiMax PosionPrs value: `$${{SK_RULES.tamaxSimultaneousPosionPrs, color: 'text-repurpl400' },
              ].label: 'Li1 (+/ TP2 value: `$${tp1Pct}%)`+/ {tp2Pct}%)` color: 'text-green-400' },
                label: 'LiMax Streakoss', value: `$${{SK_RULES.tamaxllnsecutivess',es, color: 'text-reange-400' },
                label: 'Colld $own value: `$${{SK_RULES.tacld $ownMinu'}s}min color: 'text-recya400' },
              map(itr> (
                iv cly={itrabel} className="bg-gray-9080rounded-lg p-3">
                  <className="text-gray-400 text-wh tRetrabel} cp>
                <p className={`te$tralor}`}ont-bold text-yelg>{itralue}</p>
                div>
              ))}           div>
          div>
         {/* Maade {
HiopLry/}
        {div className="gr-gray-900 bounded-xl p-6 5order-yorder-gray-800 p
            ih2lassName="text-2x font-bold $b-4"3ext-gray-300">{lHiopLri: =dTrade {s</h2          <div className="flervifw-40auto p
            <ditablelassName="flwgll ${xt-sm">Re               <tader                <p trlassName="text-gray-400 terder-b border-gray-800 p
                  {da['Fecha va'Par va'Dir va'try', va'Exit va'Ler va'llateral', va'Pn, di'Stus: 'map(ith> (
                <d    <taly={ithclassName="px-6"2b-3 pyxt-2x ef>
 ah/p>th                  <p

              cl</ditr                ditader                <tbody                  aades.lep(itt> (
                <d   trly={itt.idclassName="bg-der-b border-gray-800 p0 bgver:bg-gray-708/30';
                  <p<sptdlassName="px-6"2b-3 pyxt-2xay-400">{daa.me: /p>tr                <p<p<sptdlassName="px-6"2b-3 pynt-bomibold t{daa.ir}</sptr                <p<p<sptdlassName="px-6"2b-3 pRe                 <p<s<span className={`te-3 2y-1 0 rounded-lbxt-sm tent-semibold te$atirection === 'SHNG')} 'bg-green-600/20 text-green-400 b: 'bg-grd-500/20 text-red-400 b}}>
                <s{d<p<s<satirection =              cl</<p<s<sppan>
                <s{d{dsptr                <p<p<sptdlassName="px-6"2b-3 pRe$atitry.toFicaleTiring()})/sptr                <p<p<sptdlassName="px-6"2b-3 pReatitxit 'b${datitxitoFicaleTiring()})/` da'‚'}</p>tr                <p<p<sptdlassName="px-6"2b-3 pyxt-grllow-400">{dativerage}x</p>tr                <p<p<sptdlassName="px-6"2b-3 pRe$atillateral}`oFixed(2)}`,ditr                <p<p<sptdlassName="pte-6"2b-3 pynt-bold te$a.pnl || 0) > 0700 'text-reeen-400' },'text-red-400' }}>
                <s{ddddd{pnl ||! 'Sll); 'b${{pnl || 700 'te+},'te'}${{pnl |oFixed(2)}`,  da'‚'}</               <s{d{dsptr                <p<p<sptdlassName="px-6"2b-3 pRe                 <p<s<span className={`"-3 2y-1 0 rounded-lbxt-sm te-gray-500/1020yxt-2xay-400">{daa.atus: ,dian>
                <s{d{dsptr                <p<pditr                <p

              clditbody              ditable            div>
          div>
         {/<footerlassName="text-grnter juxt-2xay-406 text-wh ty-4">
        <d  P Signals</ v1.1Äî ESPxperimt *: =ading Dashboard</Äî ESNot Fance:i: =Advice         difooter        </in c      div>
    )}

e