const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const distributionQueue = new Queue('ntwrkh-distribution', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

async function enqueueDistributionJob(payload) {
  const job = await distributionQueue.add('publish-and-route', payload);
  return job.id;
}

module.exports = {
  connection,
  distributionQueue,
  enqueueDistributionJob,
};
