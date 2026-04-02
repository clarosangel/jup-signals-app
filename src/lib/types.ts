export interface Trade {
  id: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  exit: number | null;
  size: number;
  collateral: number;
  leverage: number;
  pnl: number | null;
  fees: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  openTime: string;
  closeTime: string | null;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export interface DailyStats {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  fees: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
}

export interface PortfolioStats {
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  currentStreak: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export type SessionName = 'Asia' | 'Europa' | 'US/Americas';

export interface TradingSession {
  name: SessionName;
  startHour: number; // UTC
  endHour: number;
  volatility: 'Low' | 'Medium' | 'High';
  targetTrades: number;
  active: boolean;
}

export const TRADING_SESSIONS: TradingSession[] = [
  { name: 'Asia', startHour: 1, endHour: 7, volatility: 'Low', targetTrades: 2, active: false },
  { name: 'Europa', startHour: 7, endHour: 13, volatility: 'Medium', targetTrades: 3, active: false },
  { name: 'US/Americas', startHour: 13, endHour: 1, volatility: 'High', targetTrades: 5, active: false },
];

export const RISK_RULES = {
  maxLeverage: 25,
  maxCollateralPercent: 0.20,
  maxSimultaneousPositions: 2,
  stopLossPercent: 0.015,
  takeProfit1Percent: 0.01,
  takeProfit2Percent: 0.02,
  maxDailyLoss: 150,
  maxConsecutiveLosses: 3,
  cooldownMinutes: 120,
  feeRate: 0.0006, // 0.06% per side
};

