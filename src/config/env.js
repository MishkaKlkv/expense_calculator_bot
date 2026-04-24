const dotenv = require('dotenv');

dotenv.config();

function parseAdminTelegramIds(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => BigInt(item));
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const env = {
  botToken: requireEnv('BOT_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  openaiApiKey: process.env.OPENAI_API_KEY || null,
  openaiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
  adminTelegramIds: parseAdminTelegramIds(process.env.ADMIN_TELEGRAM_IDS),
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = { env };
