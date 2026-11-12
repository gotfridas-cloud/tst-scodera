const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const { clearTimeout, setTimeout } = require('node:timers');
const request = require('supertest');

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const portServer = net.createServer();
    portServer.once('error', reject);
    portServer.listen(0, '127.0.0.1', () => {
      const { port } = portServer.address();
      portServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
  });
}

function waitForExit(childProcess, timeoutMs) {
  return new Promise((resolve) => {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      resolve(true);
      return;
    }

    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      childProcess.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    childProcess.once('exit', onExit);
  });
}

describe('npm start', () => {
  test('serves GET /health with HTTP 200', async () => {
    const port = await getAvailablePort();
    const npmCliPath = process.env.npm_execpath;

    if (!npmCliPath) {
      throw new Error('Run this integration test through npm test.');
    }

    const serverProcess = spawn(process.execPath, [npmCliPath, 'start'], {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    serverProcess.stderr.setEncoding('utf8');
    serverProcess.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    try {
      const deadline = Date.now() + 10_000;
      let response;

      while (Date.now() < deadline) {
        if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
          throw new Error(`npm start exited early: ${stderr}`);
        }

        try {
          response = await request(`http://127.0.0.1:${port}`).get('/health');
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      expect(response && response.status).toBe(200);
    } finally {
      if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/pid', String(serverProcess.pid), '/t', '/f'], {
            stdio: 'ignore',
          });
          await once(killer, 'exit');
          await waitForExit(serverProcess, 1_000);
        } else {
          try {
            process.kill(-serverProcess.pid, 'SIGTERM');
          } catch {
            // The process group may have exited before it could be signaled.
          }

          await waitForExit(serverProcess, 2_000);

          try {
            process.kill(-serverProcess.pid, 'SIGKILL');
          } catch {
            // The process group may have exited before it could be signaled.
          }

          await waitForExit(serverProcess, 1_000);
        }
      }
    }
  }, 15_000);
});
