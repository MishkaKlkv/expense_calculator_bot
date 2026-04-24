const {
  createFamilyForUser,
  deleteFamilyMember,
  findFamilyByInviteCode,
  getFamilyForUser,
  joinFamily,
  updateFamilyName,
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
    currentMember: membership,
    memberUserIds: members.map((member) => member.userId),
  };
}

async function renameFamily({ userId, name }) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    return { ok: false, reason: 'EMPTY_NAME' };
  }

  const context = await getFamilyContext(userId);

  if (!context) {
    return { ok: false, reason: 'NOT_IN_FAMILY' };
  }

  if (context.currentMember.role !== 'OWNER') {
    return { ok: false, reason: 'NOT_OWNER' };
  }

  const family = await updateFamilyName({
    familyAccountId: context.family.id,
    name: normalizedName,
  });

  return { ok: true, family };
}

async function removeFamilyMember({ userId, familyMemberId }) {
  const context = await getFamilyContext(userId);

  if (!context) {
    return { ok: false, reason: 'NOT_IN_FAMILY' };
  }

  if (context.currentMember.role !== 'OWNER') {
    return { ok: false, reason: 'NOT_OWNER' };
  }

  const member = context.members.find((item) => item.id === familyMemberId);

  if (!member) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  if (member.userId === userId || member.role === 'OWNER') {
    return { ok: false, reason: 'CANNOT_REMOVE_OWNER' };
  }

  const result = await deleteFamilyMember({
    familyAccountId: context.family.id,
    familyMemberId,
  });

  return { ok: result.count === 1, member };
}

module.exports = {
  createFamily,
  getFamilyContext,
  joinFamilyByCode,
  removeFamilyMember,
  renameFamily,
};
