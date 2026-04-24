const { env } = require('../config/env');

function isAdminTelegramUser(ctx) {
  if (!ctx.from?.id) {
    return false;
  }

  return env.adminTelegramIds.some((id) => id === BigInt(ctx.from.id));
}

module.exports = { isAdminTelegramUser };
