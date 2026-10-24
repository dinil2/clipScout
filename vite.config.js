import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  const plugins = [react()];

  // Only attach dev middleware when running local dev server
  if (command === 'serve') {
    plugins.push({
      name: 'local-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if ((req.url === '/api/analyze' || req.url === '/.netlify/functions/analyze') && req.method === 'POST') {
            try {
              let bodyStr = '';
              for await (const chunk of req) {
                bodyStr += chunk;
              }

              const { pathToFileURL } = await import('url');
              const functionPath = path.resolve(process.cwd(), 'netlify/functions/analyze.js');
              const functionUrl = pathToFileURL(functionPath).href + '?t=' + Date.now();
              const { handler } = await import(functionUrl);
              const response = await handler({
                httpMethod: 'POST',
                body: bodyStr,
                headers: req.headers
              });

              res.statusCode = response.statusCode || 200;
              if (response.headers) {
                Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
              }
              res.end(response.body);
            } catch (err) {
              console.error('Local API dev server error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Server error during local dev' }));
            }
            return;
          }

          // Handle Speech-to-Text Transcription via Groq Whisper for Laptop Uploads & Google Drive
          if ((req.url === '/api/transcribe' || req.url === '/.netlify/functions/transcribe') && req.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filename');
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            try {
              const fs = await import('fs');
              const os = await import('os');
              const { spawn } = await import('child_process');
              const contentType = req.headers['content-type'] || '';
              const filename = req.headers['x-filename'] ? decodeURIComponent(req.headers['x-filename']) : 'upload_media.mp4';

              // Case A: JSON body (e.g. Google Drive URL or existing local path)
              if (contentType.includes('application/json')) {
                let jsonStr = '';
                for await (const chunk of req) jsonStr += chunk;
                const body = JSON.parse(jsonStr || '{}');
                const driveUrl = body.url || '';
                const localPath = body.localFilePath || '';
                const title = body.title || 'Video';

                let audioFile = '';

                if (driveUrl && driveUrl.includes('drive.google.com')) {
                  const tempAudio = path.join(os.tmpdir(), `gdrive_audio_${Date.now()}.mp3`);
                  console.log(`Downloading audio from Google Drive: ${driveUrl}...`);
                  
                  await new Promise((resolve, reject) => {
                    const p = spawn('yt-dlp', ['-x', '--audio-format', 'mp3', '-o', tempAudio, driveUrl]);
                    p.on('close', code => code === 0 && fs.existsSync(tempAudio) ? resolve() : reject(new Error('yt-dlp failed to fetch audio from Google Drive link. Ensure link is public.')));
                  });

                  audioFile = tempAudio;
                } else if (localPath && fs.existsSync(localPath)) {
                  const tempAudio = path.join(os.tmpdir(), `local_audio_${Date.now()}.mp3`);
                  await new Promise((resolve, reject) => {
                    const p = spawn('ffmpeg', ['-y', '-i', localPath, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k', tempAudio]);
                    p.on('close', code => code === 0 && fs.existsSync(tempAudio) ? resolve() : reject(new Error('FFmpeg failed to extract audio from local file')));
                  });
                  audioFile = tempAudio;
                }

                if (!audioFile || !fs.existsSync(audioFile)) {
                  throw new Error('Could not extract audio for transcription.');
                }

                const { transcribeAudioWithWhisper } = await import('./netlify/functions/lib/whisper.js');
                const whisperResult = await transcribeAudioWithWhisper(audioFile, 'audio.mp3');
                try { fs.unlinkSync(audioFile); } catch {}

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  video: {
                    videoId: driveUrl ? driveUrl : localPath,
                    title: title || (driveUrl ? 'Google Drive Podcast' : path.basename(localPath)),
                    author: driveUrl ? 'Google Drive' : 'Local Laptop Video',
                    isGoogleDrive: !!driveUrl,
                    isLocalFile: !driveUrl,
                    googleDriveUrl: driveUrl,
                    localFilePath: localPath,
                    durationSeconds: whisperResult.totalDurationSec
                  },
                  transcriptSegments: whisperResult.segments,
                  totalDurationSec: whisperResult.totalDurationSec
                }));
                return;
              }

              // Case B: Direct binary upload from user's laptop
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              const buffer = Buffer.concat(chunks);
              const ext = path.extname(filename).toLowerCase() || '.mp4';
              const tempVideoPath = path.join(os.tmpdir(), `laptop_upload_${Date.now()}${ext}`);
              fs.writeFileSync(tempVideoPath, buffer);

              // Extract audio using ffmpeg
              const tempAudioPath = path.join(os.tmpdir(), `laptop_audio_${Date.now()}.mp3`);
              console.log(`Extracting audio from uploaded laptop file ${filename}...`);
              await new Promise((resolve, reject) => {
                const p = spawn('ffmpeg', ['-y', '-i', tempVideoPath, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k', tempAudioPath]);
                p.on('close', (code) => {
                  if (code === 0 && fs.existsSync(tempAudioPath)) resolve();
                  else reject(new Error('FFmpeg failed to extract audio from uploaded file'));
                });
              });

              const { transcribeAudioWithWhisper } = await import('./netlify/functions/lib/whisper.js');
              const whisperResult = await transcribeAudioWithWhisper(tempAudioPath, 'audio.mp3');
              try { fs.unlinkSync(tempAudioPath); } catch {}

              const safeName = filename.replace(/\.[^/.]+$/, '');

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                video: {
                  videoId: tempVideoPath,
                  title: safeName,
                  author: 'Local Laptop Video',
                  isLocalFile: true,
                  localFilePath: tempVideoPath,
                  durationSeconds: whisperResult.totalDurationSec
                },
                transcriptSegments: whisperResult.segments,
                totalDurationSec: whisperResult.totalDurationSec
              }));
              return;

            } catch (err) {
              console.error('Transcription server error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Transcription failed' }));
              return;
            }
          }

          // Handle 1080p Clip Download via Python yt-dlp
          if (req.url.startsWith('/api/download') && (req.method === 'GET' || req.method === 'POST' || req.method === 'OPTIONS')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            try {
              const urlObj = new URL(req.url, 'http://localhost');
              let videoId = urlObj.searchParams.get('videoId');
              let start = parseInt(urlObj.searchParams.get('start') || '0');
              let end = parseInt(urlObj.searchParams.get('end') || '30');
              let title = urlObj.searchParams.get('title') || 'clip';

              if (req.method === 'POST') {
                let bodyStr = '';
                for await (const chunk of req) {
                  bodyStr += chunk;
                }
                if (bodyStr) {
                  const b = JSON.parse(bodyStr);
                  if (b.videoId) videoId = b.videoId;
                  if (b.start !== undefined) start = parseInt(b.start);
                  if (b.end !== undefined) end = parseInt(b.end);
                  if (b.title) title = b.title;
                }
              }

              if (!videoId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing videoId' }));
                return;
              }

              // In local dev server (command === 'serve'), local download via Python/yt-dlp is enabled by default
              const isLocalDownloadEnabled = process.env.VITE_ENABLE_LOCAL_DOWNLOAD !== 'false';
              if (!isLocalDownloadEnabled) {
                const { pathToFileURL } = await import('url');
                const functionPath = path.resolve(process.cwd(), 'netlify/functions/download.js');
                const functionUrl = pathToFileURL(functionPath).href + '?t=' + Date.now();
                const { handler } = await import(functionUrl);
                const response = await handler({
                  httpMethod: req.method,
                  queryStringParameters: Object.fromEntries(urlObj.searchParams.entries()),
                  headers: req.headers
                });

                res.statusCode = response.statusCode || 200;
                if (response.headers) {
                  Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
                }
                res.end(response.body);
                return;
              }

              const fs = await import('fs');
              const os = await import('os');
              const { spawn } = await import('child_process');

              const safeId = String(videoId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(-25);
              const tempFileName = `clip_${safeId}_${start}_${end}_${Date.now()}.mp4`;
              const tempFilePath = path.join(os.tmpdir(), tempFileName);
              const scriptPath = path.resolve(process.cwd(), 'server/clipper.py');

              console.log(`Starting Python 1080p download: [${start}s - ${end}s]...`);

              const pyProc = spawn('python', [scriptPath, videoId, String(start), String(end), tempFilePath]);
              
              let stderr = '';
              pyProc.stderr.on('data', (d) => stderr += d.toString());

              pyProc.on('close', (code) => {
                let actualPath = tempFilePath;
                if (!fs.existsSync(actualPath) && fs.existsSync(tempFilePath + '.mp4')) {
                  actualPath = tempFilePath + '.mp4';
                }

                if (code !== 0 || !fs.existsSync(actualPath)) {
                  console.error('Python clipper failed:', stderr);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Download failed. Ensure video is available.' }));
                  return;
                }

                const stat = fs.statSync(actualPath);
                const safeTitle = (title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${start}-${end}.mp4"`);
                res.setHeader('Content-Length', stat.size);

                const stream = fs.createReadStream(actualPath);
                stream.pipe(res);
                stream.on('end', () => {
                  try {
                    fs.unlinkSync(actualPath);
                  } catch(e) {}
                });
              });

            } catch (err) {
              console.error('Download server error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Download error' }));
            }
            return;
          }

          next();
        });
      }
    });
  }

  return {
    plugins,
    server: {
      port: 5173
    }
  };
});
