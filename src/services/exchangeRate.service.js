const CBR_DAILY_XML_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const USD_CBR_ID = 'R01235';
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedUsdRate = null;

function parseCbrNumber(value) {
  return Number(value.replace(',', '.'));
}

function parseUsdRateFromCbrXml(xml) {
  const usdBlockMatch = xml.match(
    new RegExp(`<Valute[^>]*ID="${USD_CBR_ID}"[^>]*>[\\s\\S]*?<\\/Valute>`, 'u')
  );

  if (!usdBlockMatch) {
    return null;
  }

  const block = usdBlockMatch[0];
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

async function getUsdToRubRate() {
  const now = Date.now();

  if (cachedUsdRate && now - cachedUsdRate.fetchedAt < CACHE_TTL_MS) {
    return cachedUsdRate;
  }

  const response = await fetch(CBR_DAILY_XML_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch USD rate: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parseUsdRateFromCbrXml(xml);

  if (!parsed) {
    throw new Error('Failed to parse USD rate from CBR XML');
  }

  cachedUsdRate = {
    ...parsed,
    fetchedAt: now,
  };

  return cachedUsdRate;
}

module.exports = {
  getUsdToRubRate,
  parseUsdRateFromCbrXml,
};
