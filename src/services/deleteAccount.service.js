const { deleteBotEventsByTelegramUserId } = require('../repositories/botEvent.repository');
const { getFamilyContext } = require('./family.service');
const { deleteTelegramUserById } = require('../repositories/user.repository');

function getRandomNumber(min = 10, max = 99) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDeleteAccountChallenge() {
  const target = getRandomNumber();
  const numbers = new Set([target]);

  while (numbers.size < 3) {
    numbers.add(getRandomNumber());
  }

  const options = Array.from(numbers).sort(() => Math.random() - 0.5);

  return { options, target };
}

async function canDeleteAccount(userId) {
  const context = await getFamilyContext(userId);

  if (
    context?.currentMember.role === 'OWNER' &&
    context.members.some((member) => member.userId !== userId)
  ) {
    return {
      ok: false,
      reason: 'OWNER_WITH_MEMBERS',
      family: context.family,
    };
  }

  return { ok: true };
}

async function deleteAccount(user) {
  const availability = await canDeleteAccount(user.id);

  if (!availability.ok) {
    return availability;
  }

  await deleteBotEventsByTelegramUserId(user.telegramUserId);
  await deleteTelegramUserById(user.id);

  return { ok: true };
}

module.exports = {
  canDeleteAccount,
  deleteAccount,
  generateDeleteAccountChallenge,
};
