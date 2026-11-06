/**
 * Safe Child Process Execution Utility
 * Spawns processes strictly using argument arrays (prevents shell injection).
 * Tracks child processes per job to ensure clean termination on cancellation.
 */

import { spawn } from 'child_process';

// Map of jobId -> Set<ChildProcess>
const activeProcessesByJob = new Map();

/**
 * Register a running child process with a jobId for cancellation tracking
 * @param {string} jobId
 * @param {import('child_process').ChildProcess} child
 */
export function registerJobProcess(jobId, child) {
  if (!jobId) return;
  if (!activeProcessesByJob.has(jobId)) {
    activeProcessesByJob.set(jobId, new Set());
  }
  activeProcessesByJob.get(jobId).add(child);

  child.on('close', () => {
    const set = activeProcessesByJob.get(jobId);
    if (set) {
      set.delete(child);
      if (set.size === 0) activeProcessesByJob.delete(jobId);
    }
  });
}

/**
 * Terminate all running processes registered to a specific job
 * @param {string} jobId
 */
export function killJobProcesses(jobId) {
  const set = activeProcessesByJob.get(jobId);
  if (!set || set.size === 0) return;

  for (const child of set) {
    try {
      if (!child.killed) {
        // On Windows, kill process tree
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
        } else {
          child.kill('SIGKILL');
        }
      }
    } catch (err) {
      console.warn(`Error killing process ${child.pid} for job ${jobId}:`, err.message);
    }
  }

  activeProcessesByJob.delete(jobId);
}

/**
 * Runs a child process with argument array and returns stdout/stderr/exitCode.
 *
 * @param {string} command - Binary name (e.g. 'ffmpeg', 'yt-dlp', 'ffprobe')
 * @param {string[]} args - Strictly typed argument array
 * @param {Object} [options]
 * @param {string} [options.jobId] - Optional job ID to track for cancellation
 * @param {string} [options.cwd]
 * @param {number} [options.timeoutMs]
 * @param {(data: string) => void} [options.onStderr]
 * @param {(data: string) => void} [options.onStdout]
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function runProcess(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let timer = null;

    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (options.jobId) {
      registerJobProcess(options.jobId, child);
    }

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
        reject(new Error(`Command '${command}' timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      stdoutData += str;
      if (options.onStdout) options.onStdout(str);
    });

    child.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      stderrData += str;
      if (options.onStderr) options.onStderr(str);
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) return;

      resolve({
        stdout: stdoutData,
        stderr: stderrData,
        exitCode: code ?? 0
      });
    });
  });
}

