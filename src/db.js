const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getOrCreateUser(platform, platformUserId, displayName = 'Creator') {
  return prisma.user.upsert({
    where: {
      platform_platformUserId: { platform, platformUserId },
    },
    update: {
      displayName: displayName || undefined,
    },
    create: {
      platform,
      platformUserId,
      displayName: displayName || 'Creator',
    },
    include: {
      socialAccounts: true,
    },
  });
}

async function getUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { socialAccounts: true },
  });
}

async function updateUserNiches(userId, tags) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const merged = Array.from(new Set([...(user?.niches || []), ...tags]));
  return prisma.user.update({
    where: { id: userId },
    data: { niches: merged },
    include: { socialAccounts: true },
  });
}

async function upsertSocialAccount(userId, data) {
  return prisma.socialAccount.upsert({
    where: {
      userId_provider: { userId, provider: data.provider },
    },
    update: {
      providerUserId: data.providerUserId,
      username: data.username || null,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      expiresAt: data.expiresAt || null,
    },
    create: {
      userId,
      provider: data.provider,
      providerUserId: data.providerUserId,
      username: data.username || null,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      expiresAt: data.expiresAt || null,
    },
  });
}

async function findMatchedAudience(excludeUserId, hashtags) {
  if (!hashtags || hashtags.length === 0) return [];
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      niches: { hasSome: hashtags },
    },
    take: 50,
  });
}

async function recordPostAndReach({
  userId,
  caption,
  mediaUrl,
  mediaType,
  originalTags,
  expandedTags,
  matchedUsers,
  publishedTargets,
}) {
  const simulatedReach = matchedUsers * 45 + 120;
  const [post] = await prisma.$transaction([
    prisma.post.create({
      data: {
        userId,
        caption,
        mediaUrl,
        mediaType,
        originalTags,
        expandedTags,
        matchedUsers,
        publishedTargets,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        postsCount: { increment: 1 },
        totalReach: { increment: simulatedReach },
      },
    }),
  ]);
  return { post, simulatedReach };
}

async function createPendingPayment(userId, reference, amount) {
  return prisma.payment.create({
    data: {
      userId,
      reference,
      amount,
      status: 'pending',
    },
  });
}

async function markPaymentSuccess(reference) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.status === 'success') return null;

  const [updatedPayment, updatedUser] = await prisma.$transaction([
    prisma.payment.update({
      where: { reference },
      data: { status: 'success' },
    }),
    prisma.user.update({
      where: { id: payment.userId },
      data: { plan: 'pro' },
    }),
  ]);
  return { payment: updatedPayment, user: updatedUser };
}

module.exports = {
  prisma,
  getOrCreateUser,
  getUserById,
  updateUserNiches,
  upsertSocialAccount,
  findMatchedAudience,
  recordPostAndReach,
  createPendingPayment,
  markPaymentSuccess,
};
