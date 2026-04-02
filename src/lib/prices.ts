// Jupiter & CoinGecko price fetching
import { Candle } from './ema';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const PAIR_IDS: Record<string, { coingecko: string; symbol: string }> = {
  ETH: { coingecko: 'ethereum', symbol: 'ETH' },
  SOL: { coingecko: 'solana', symbol: 'SOL' },
  WBTC: { coingecko: 'bitcoin', symbol: 'WBTC' },
};

export interface PairPrice {
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export async function fetchPrices(): Promise<PairPrice[]> {
  const ids = Object.values(PAIR_IDS).map(p => p.coingecko).join(',');
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true`;

  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    const data = await res.json();

    return Object.entries(PAIR_IDS).map(([pair, { coingecko }]) => {
      const d = data[coingecko] || {};
      return {
        pair,
        price: d.usd || 0,
        change24h: d.usd_24h_change || 0,
        high24h: 0,
        low24h: 0,
        volume24h: d.usd_24h_vol || 0,
        marketCap: d.usd_market_cap || 0,
        lastUpdated: new Date((d.last_updated_at || 0) * 1000).toISOString(),
      };
    });
  } catch (err) {
    console.error('Price fetch error:', err);
    return [];
  }
}

export async function fetchCandles(pair: string, days: number = 14): Promise<Candle[]> {
  const pairInfo = PAIR_IDS[pair];
  if (!pairInfo) return [];

  // CoinGecko OHLC endpoint
  const url = `${COINGECKO_BASE}/coins/${pairInfo.coingecko}/ohlc?vs_currency=usd&days=${days}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data: number[][] = await res.json();

    return data.map(([time, open, high, low, close]) => ({
      time,
      open,
      high,
      low,
      close,
      volume: 0,
    }));
  } catch (err) {
    console.error('Candle fetch error:', err);
    return [];
  }
}

export async function fetchFearGreedIndex(): Promise<{ value: number; classification: string }> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 300 } });
    const data = await res.json();
    const item = data.data?.[0];
    return {
      value: parseInt(item?.value || '50'),
      classification: item?.value_classification || 'Neutral',
    };
  } catch {
    return { value: 50, classification: 'Neutral' };
  }
}

export interface MarketOverview {
  prices: PairPrice[];
  fearGreed: { value: number; classification: string };
  timestamp: string;
  btcDominance: number;
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  const [prices, fearGreed, globalData] = await Promise.all([
    fetchPrices(),
    fetchFearGreedIndex(),
    fetchBTCDominance(),
  ]);

  return {
    prices,
    fearGreed,
    timestamp: new Date().toISOString(),
    btcDominance: globalData,
  };
}

async function fetchBTCDominance(): Promise<number> {
  try {
    const res = await fetch(`${COINGECKO_BASE}/global`, { next: { revalidate: 300 } });
    const data = await res.json();
    return data.data?.market_cap_percentage?.btc || 0;
  } catch {
    return 0;
  }
}

