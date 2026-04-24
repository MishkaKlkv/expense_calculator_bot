const {
  createFamilyForUser,
  findFamilyByInviteCode,
  getFamilyForUser,
  joinFamily,
} = require('../repositories/family.repository');

function normalizeInviteCode(value) {
  return value.trim().toUpperCase();
}

async function createFamily({ user, name }) {
  const existingMembership = await getFamilyForUser(user.id);

  if (existingMembership) {
    return {
      ok: false,
      reason: 'ALREADY_IN_FAMILY',
      family: existingMembership.familyAccount,
    };
  }

  const family = await createFamilyForUser({
    userId: user.id,
    name: name || 'Семейный счет',
  });

  return { ok: true, family };
}

async function joinFamilyByCode({ user, inviteCode }) {
  const existingMembership = await getFamilyForUser(user.id);

  if (existingMembership) {
    return {
      ok: false,
      reason: 'ALREADY_IN_FAMILY',
      family: existingMembership.familyAccount,
    };
  }

  const family = await findFamilyByInviteCode(normalizeInviteCode(inviteCode));

  if (!family) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const membership = await joinFamily({
    familyAccountId: family.id,
    userId: user.id,
  });

  return { ok: true, family: membership.familyAccount };
}

async function getFamilyContext(userId) {
  const membership = await getFamilyForUser(userId);

  if (!membership) {
    return null;
  }

  const members = membership.familyAccount.members;

  return {
    family: membership.familyAccount,
    members,
    memberUserIds: members.map((member) => member.userId),
  };
}

module.exports = {
  createFamily,
  getFamilyContext,
  joinFamilyByCode,
};
