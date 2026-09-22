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

          // Handle 1080p Clip Download via Python yt-dlp
          if (req.url.startsWith('/api/download') && (req.method === 'GET' || req.method === 'POST')) {
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

              const fs = await import('fs');
              const os = await import('os');
              const { spawn } = await import('child_process');

              const tempFileName = `clip_${videoId}_${start}_${end}_${Date.now()}.mp4`;
              const tempFilePath = path.join(os.tmpdir(), tempFileName);
              const scriptPath = path.resolve(process.cwd(), 'server/clipper.py');

              console.log(`Starting Python 1080p download: ${videoId} [${start}s - ${end}s]...`);

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
