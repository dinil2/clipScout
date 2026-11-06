/**
 * Jobs Routes: POST /jobs, GET /jobs/:id, GET /jobs/:id/events (SSE), DELETE /jobs/:id
 */

import { createJobSchema } from '../lib/validate.js';
import { createJob, getJob, getJobPublicState, registerEventListener, cancelJob } from '../services/jobs.js';
import { fetchTrendingTopicHashtags } from '../services/hashtags.js';

export default async function jobsRoutes(fastify) {
  // Create and launch job
  fastify.post('/jobs', async (request, reply) => {
    const parseResult = createJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid job request parameters',
        details: parseResult.error.format()
      });
    }

    try {
      const jobId = await createJob(parseResult.data);
      return reply.status(201).send({ jobId });
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to initialize job.' });
    }
  });

  // Get job state
  fastify.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const job = getJob(id);
    if (!job) {
      return reply.status(404).send({ error: `Job "${id}" not found.` });
    }
    return reply.send(getJobPublicState(job));
  });

  // Server-Sent Events stream
  fastify.get('/jobs/:id/events', async (request, reply) => {
    const { id } = request.params;
    const job = getJob(id);
    if (!job) {
      return reply.status(404).send({ error: `Job "${id}" not found.` });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    registerEventListener(id, reply);
  });

  // Cancel job
  fastify.delete('/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const cancelled = cancelJob(id);
    if (!cancelled) {
      return reply.status(404).send({ error: `Job "${id}" not found or already completed.` });
    }
    return reply.send({ success: true, message: 'Job cancelled successfully.' });
  });

  // Optional: Check trending topic tags via YouTube Data API
  fastify.get('/jobs/:id/trending-tags', async (request, reply) => {
    const { id } = request.params;
    const { topic } = request.query;

    const job = getJob(id);
    if (!job) {
      return reply.status(404).send({ error: `Job "${id}" not found.` });
    }

    const queryTopic = topic || job.video?.title || 'podcast';
    const result = await fetchTrendingTopicHashtags(queryTopic);

    if (!result) {
      return reply.status(200).send({
        available: false,
        message: 'YouTube Data API key is not configured or returned no results.'
      });
    }

    return reply.send({
      available: true,
      topic: queryTopic,
      ...result
    });
  });
}

