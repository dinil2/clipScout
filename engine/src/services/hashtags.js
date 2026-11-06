/**
 * YouTube Studio Hashtags & Trending Tags Service
 * Formats 3-5 high-relevance hashtags including #Shorts (hard cap 15).
 * Optionally queries YouTube Data API v3 for top videos in the topic space.
 */

import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';

const TRENDING_CACHE_FILE = path.join(CONFIG.DATA_DIR, 'trending_tags_cache.json');

/**
 * Normalizes hashtag (ensures leading '#' and lowercase)
 * @param {string} tag
 * @returns {string}
 */
export function normalizeTag(tag) {
  if (!tag) return '';
  const clean = tag.trim().replace(/^[#\s]+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  return clean ? `#${clean}` : '';
}

/**
 * Builds compliant hashtag array (3-5 recommended, always includes #Shorts, hard cap 15)
 *
 * @param {string[]} rawTags
 * @param {string[]} [trendingTags=[]]
 * @returns {Array<{ tag: string, source: 'AI suggestion' | 'Used by top videos on this topic' }>}
 */
export function buildClipHashtags(rawTags = [], trendingTags = []) {
  const map = new Map();

  // Always include #Shorts as first tag
  map.set('#shorts', { tag: '#Shorts', source: 'AI suggestion' });

  // Add trending tags if present
  for (const t of trendingTags) {
    const norm = normalizeTag(t);
    if (norm && !map.has(norm.toLowerCase())) {
      map.set(norm.toLowerCase(), { tag: norm, source: 'Used by top videos on this topic' });
    }
  }

  // Add AI suggestions
  for (const t of rawTags) {
    const norm = normalizeTag(t);
    if (norm && !map.has(norm.toLowerCase())) {
      map.set(norm.toLowerCase(), { tag: norm, source: 'AI suggestion' });
    }
  }

  // If still fewer than 3, add helpful general podcast tags
  const defaults = ['#Podcast', '#PodcastClips', '#LifeLessons'];
  for (const def of defaults) {
    if (map.size >= 4) break;
    const norm = normalizeTag(def);
    if (!map.has(norm.toLowerCase())) {
      map.set(norm.toLowerCase(), { tag: norm, source: 'AI suggestion' });
    }
  }

  // Enforce YouTube hard maximum limit of 15 hashtags (more and YouTube ignores ALL of them)
  const result = Array.from(map.values()).slice(0, 15);
  return result;
}

/**
 * Searches top YouTube videos for a topic to extract authentic trending hashtags.
 * Caches results for 24 hours to stay strictly within free daily quota.
 *
 * @param {string} topic
 * @returns {Promise<{ hashtags: Array<{ tag: string, count: number }>, quotaUsed: number, fromCache: boolean }|null>}
 */
export async function fetchTrendingTopicHashtags(topic) {
  const apiKey = CONFIG.YOUTUBE_API_KEY;
  if (!apiKey || !topic) return null;

  // 1. Check 24h disk cache
  let cache = {};
  try {
    if (fs.existsSync(TRENDING_CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(TRENDING_CACHE_FILE, 'utf-8'));
      const entry = cache[topic.toLowerCase()];
      if (entry && (Date.now() - entry.timestamp) < 24 * 60 * 60 * 1000) {
        return {
          hashtags: entry.hashtags,
          quotaUsed: 0,
          fromCache: true
        };
      }
    }
  } catch {}

  try {
    // Search top 10 videos by view count for this topic (Cost: 100 quota units)
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&q=${encodeURIComponent(topic + ' shorts')}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
      console.warn(`YouTube API search failed (${searchRes.status})`);
      return null;
    }

    const searchData = await searchRes.json();
    const videoIds = (searchData.items || []).map(i => i.id?.videoId).filter(Boolean);

    if (videoIds.length === 0) return null;

    // Fetch video details for tags (Cost: 1 quota unit)
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds.join(',')}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) return null;

    const detailsData = await detailsRes.json();
    const tagFrequency = new Map();

    for (const item of (detailsData.items || [])) {
      const tags = item.snippet?.tags || [];
      const desc = item.snippet?.description || '';

      // Collect snippet tags
      for (const t of tags) {
        const norm = normalizeTag(t);
        if (norm) {
          tagFrequency.set(norm, (tagFrequency.get(norm) || 0) + 1);
        }
      }

      // Collect hashtags in description (#word)
      const descTags = desc.match(/#\w+/g) || [];
      for (const dt of descTags) {
        const norm = normalizeTag(dt);
        if (norm) {
          tagFrequency.set(norm, (tagFrequency.get(norm) || 0) + 1);
        }
      }
    }

    const sortedTags = Array.from(tagFrequency.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Save to cache
    try {
      cache[topic.toLowerCase()] = {
        timestamp: Date.now(),
        hashtags: sortedTags
      };
      fs.writeFileSync(TRENDING_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch {}

    return {
      hashtags: sortedTags,
      quotaUsed: 101, // 100 search + 1 videos
      fromCache: false
    };
  } catch (err) {
    console.warn('Error fetching YouTube trending hashtags:', err.message);
    return null;
  }
}

