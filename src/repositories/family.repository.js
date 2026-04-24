const crypto = require('crypto');
const { prisma } = require('../db/prisma');

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function getFamilyForUser(userId) {
  return prisma.familyMember.findUnique({
    where: {
      userId,
    },
    include: {
      familyAccount: {
        include: {
          members: {
            include: {
              user: true,
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      },
    },
  });
}

async function createFamilyForUser({ userId, name }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode();

    try {
      return await prisma.familyAccount.create({
        data: {
          name,
          inviteCode,
          createdByUserId: userId,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
        include: {
          members: true,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique family invite code');
}

async function findFamilyByInviteCode(inviteCode) {
  return prisma.familyAccount.findUnique({
    where: {
      inviteCode,
    },
  });
}

async function joinFamily({ familyAccountId, userId }) {
  return prisma.familyMember.create({
    data: {
      familyAccountId,
      userId,
      role: 'MEMBER',
    },
    include: {
      familyAccount: true,
    },
  });
}

module.exports = {
  createFamilyForUser,
  findFamilyByInviteCode,
  getFamilyForUser,
  joinFamily,
};
