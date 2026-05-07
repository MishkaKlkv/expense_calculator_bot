const {
  deleteAccountConfirmKeyboard,
  deleteAccountNumberKeyboard,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  canDeleteAccount,
  deleteAccount,
  generateDeleteAccountChallenge,
} = require('../../services/deleteAccount.service');

async function startDeleteAccount(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const availability = await canDeleteAccount(user.id);

  if (!availability.ok && availability.reason === 'OWNER_WITH_MEMBERS') {
    await ctx.reply(
      `Нельзя удалить аккаунт, пока вы владелец семейного счета "${availability.family.name}" с другими участниками. Сначала удалите участников из семейного счета.`
    );
    return;
  }

  await ctx.reply(
    [
      'Вы действительно хотите удалить аккаунт в боте и все данные о своих расходах?',
      'Это действие отменить невозможно.',
    ].join('\n'),
    deleteAccountConfirmKeyboard()
  );
}

function registerDeleteAccountHandlers(bot) {
  bot.command('delete_account', startDeleteAccount);

  bot.action('DELETE_ACCOUNT_CONFIRM', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const availability = await canDeleteAccount(user.id);

    await ctx.answerCbQuery();

    if (!availability.ok && availability.reason === 'OWNER_WITH_MEMBERS') {
      await ctx.reply(
        `Нельзя удалить аккаунт, пока вы владелец семейного счета "${availability.family.name}" с другими участниками. Сначала удалите участников из семейного счета.`
      );
      return;
    }

    const challenge = generateDeleteAccountChallenge();

    await ctx.reply(
      `Для удаления нажмите кнопку с числом ${challenge.target}.`,
      deleteAccountNumberKeyboard(challenge.target, challenge.options)
    );
  });

  bot.action(/^DELETE_ACCOUNT_NUMBER:(\d{2}):(\d{2})$/u, async (ctx) => {
    const target = Number(ctx.match[1]);
    const picked = Number(ctx.match[2]);

    await ctx.answerCbQuery();

    if (target !== picked) {
      await ctx.reply('Удаление аккаунта отменено.');
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const result = await deleteAccount(user);

    if (!result.ok && result.reason === 'OWNER_WITH_MEMBERS') {
      await ctx.reply(
        `Нельзя удалить аккаунт, пока вы владелец семейного счета "${result.family.name}" с другими участниками. Сначала удалите участников из семейного счета.`
      );
      return;
    }

    await ctx.reply('Аккаунт и данные удалены.');
  });
}

module.exports = { registerDeleteAccountHandlers };
