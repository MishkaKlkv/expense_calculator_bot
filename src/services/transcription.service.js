const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const OpenAI = require('openai');
const ffmpegPath = require('ffmpeg-static');
const { env } = require('../config/env');

const execFileAsync = promisify(execFile);

function getOpenAIClient() {
  if (!env.openaiApiKey) {
    return null;
  }

  return new OpenAI({
    apiKey: env.openaiApiKey,
  });
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download voice file: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(outputPath, buffer);
}

async function convertToMp3(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary is not available');
  }

  await execFileAsync(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-ar',
    '16000',
    '-ac',
    '1',
    outputPath,
  ]);
}

async function transcribeTelegramVoice(ctx, fileId) {
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      ok: false,
      reason: 'OPENAI_API_KEY_MISSING',
    };
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expense-voice-'));
  const inputPath = path.join(tempDir, 'voice.oga');
  const outputPath = path.join(tempDir, 'voice.mp3');

  try {
    const fileUrl = await ctx.telegram.getFileLink(fileId);

    await downloadFile(fileUrl.href, inputPath);
    await convertToMp3(inputPath, outputPath);

    let transcription;

    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(outputPath),
        model: env.openaiTranscriptionModel,
        language: 'ru',
        prompt:
          'Пользователь диктует короткую запись о расходе или кешбеке. Примеры: перекресток 580, кофе 300, нет, кешбек 250.',
      });
    } catch (error) {
      if (error.status === 429 && error.code === 'insufficient_quota') {
        return {
          ok: false,
          reason: 'OPENAI_INSUFFICIENT_QUOTA',
        };
      }

      if (error.status === 429) {
        return {
          ok: false,
          reason: 'OPENAI_RATE_LIMIT',
        };
      }

      throw error;
    }

    return {
      ok: true,
      text: transcription.text.trim(),
    };
  } finally {
    await fs.promises.rm(tempDir, { force: true, recursive: true });
  }
}

module.exports = { transcribeTelegramVoice };
