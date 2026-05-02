const { getUsdToRubRate } = require('./exchangeRate.service');

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CACHE_TTL_MS = 10 * 60 * 1000;

const marketSymbols = {
  bitcoin: 'BTC-USD',
  gold: 'GC=F',
  oil: 'BZ=F',
};

let cachedSnapshot = null;

function getLastFinite(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function parseYahooChartPrice(data) {
  const result = data?.chart?.result?.[0];
  const metaPrice = Number(result?.meta?.regularMarketPrice);

  if (Number.isFinite(metaPrice) && metaPrice > 0) {
    return metaPrice;
  }

  const closePrices = result?.indicators?.quote?.[0]?.close;
  return getLastFinite(closePrices);
}

async function fetchYahooPrice(symbol) {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const price = parseYahooChartPrice(data);

  if (!price) {
    throw new Error(`Failed to parse ${symbol} price`);
  }

  return {
    source: 'Yahoo Finance',
    symbol,
    value: price,
  };
}

function settle(result) {
  if (result.status === 'fulfilled') {
    return {
      ok: true,
      ...result.value,
    };
  }

  return {
    error: result.reason?.message || 'unknown error',
    ok: false,
  };
}

async function getMarketRatesSnapshot() {
  const now = Date.now();

  if (cachedSnapshot && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const [usd, gold, oil, bitcoin] = await Promise.allSettled([
    getUsdToRubRate(),
    fetchYahooPrice(marketSymbols.gold),
    fetchYahooPrice(marketSymbols.oil),
    fetchYahooPrice(marketSymbols.bitcoin),
  ]);

  const snapshot = {
    bitcoin: settle(bitcoin),
    fetchedAt: now,
    gold: settle(gold),
    oil: settle(oil),
    usd: settle(usd),
  };

  if ([snapshot.bitcoin, snapshot.gold, snapshot.oil, snapshot.usd].some((rate) => rate.ok)) {
    cachedSnapshot = snapshot;
  }

  return snapshot;
}

module.exports = {
  getMarketRatesSnapshot,
  parseYahooChartPrice,
};
