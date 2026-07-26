const CBR_DAILY_XML_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CBR_CURRENCY_IDS = {
  GEL: 'R01210',
  USD: 'R01235',
};
const CACHE_TTL_MS = 60 * 60 * 1000;

const cachedRates = new Map();

function parseCbrNumber(value) {
  return Number(value.replace(',', '.'));
}

function parseCbrRateFromXml(xml, cbrId) {
  const currencyBlockMatch = xml.match(
    new RegExp(`<Valute[^>]*ID="${cbrId}"[^>]*>[\\s\\S]*?<\\/Valute>`, 'u')
  );

  if (!currencyBlockMatch) {
    return null;
  }

  const block = currencyBlockMatch[0];
  const nominalMatch = block.match(/<Nominal>(\d+)<\/Nominal>/u);
  const valueMatch = block.match(/<Value>([\d,]+)<\/Value>/u);
  const dateMatch = xml.match(/<ValCurs[^>]*Date="([^"]+)"/u);

  if (!nominalMatch || !valueMatch) {
    return null;
  }

  const nominal = Number(nominalMatch[1]);
  const value = parseCbrNumber(valueMatch[1]);

  if (!nominal || !Number.isFinite(value)) {
    return null;
  }

  return {
    date: dateMatch?.[1] || null,
    source: 'ЦБ РФ',
    value: value / nominal,
  };
}

function parseUsdRateFromCbrXml(xml) {
  return parseCbrRateFromXml(xml, CBR_CURRENCY_IDS.USD);
}

async function getCurrencyToRubRate(currency) {
  const cbrId = CBR_CURRENCY_IDS[currency];

  if (!cbrId) {
    throw new Error(`Unsupported CBR currency: ${currency}`);
  }

  const now = Date.now();
  const cachedRate = cachedRates.get(currency);

  if (cachedRate && now - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  const response = await fetch(CBR_DAILY_XML_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch USD rate: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parseCbrRateFromXml(xml, cbrId);

  if (!parsed) {
    throw new Error(`Failed to parse ${currency} rate from CBR XML`);
  }

  const rate = {
    ...parsed,
    fetchedAt: now,
  };
  cachedRates.set(currency, rate);

  return rate;
}

function getUsdToRubRate() {
  return getCurrencyToRubRate('USD');
}

function getGelToRubRate() {
  return getCurrencyToRubRate('GEL');
}

module.exports = {
  getCurrencyToRubRate,
  getGelToRubRate,
  getUsdToRubRate,
  parseCbrRateFromXml,
  parseUsdRateFromCbrXml,
};
