// [Layer: Testing/Frontend/Fixtures]
// Responsibility: Shared E2E backend + Anthropic test wire server + Vite frontend process lifecycle manager.
// Guarantees every standalone E2E script passes when invoked individually or via Testing/run_all_tests.ps1 and cleans up all child processes on exit.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO test-mode production bypasses, 100% Universal Arrow Lambdas (=>).

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startAnthropicTestWireServer, type AnthropicWireServerHandle } from './anthropicTestWireServer';

export const E2E_BACKEND_URL = 'http://127.0.0.1:1999';
export const E2E_CIVILIAN_FRONTEND_URL = 'http://127.0.0.1:1998';
export const E2E_RESPONDER_FRONTEND_URL = 'http://127.0.0.1:1997';

const resolveRepoRoot = (): string => {
  const candidates: string[] = [
    ...(typeof __dirname === 'string' ? [join(__dirname, '..', '..', '..')] : []),
    process.cwd(),
    join(process.cwd(), '..'),
    join(process.cwd(), '..', '..')
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'Project system ENGINE', 'Backend'))) {
      return candidate;
    }
  }
  return process.cwd();
};

const REPO_ROOT = resolveRepoRoot();
const ENGINE_BACKEND_DIR = join(REPO_ROOT, 'Project system ENGINE', 'Backend');
const ENGINE_FRONTEND_DIR = join(REPO_ROOT, 'Project system ENGINE', 'Frontend');

export interface E2eServerOptions {
  readonly includeResponder?: boolean;
  readonly useWireServer?: boolean;
}

export interface E2eServersHandle {
  readonly wireServer: AnthropicWireServerHandle | null;
  readonly pids: readonly number[];
  readonly stopAll: () => Promise<void>;
}

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolveDelay: () => void): void => {
    setTimeout(resolveDelay, ms);
  });

export const probeHttpReady = async (url: string, timeoutMs = 2000): Promise<boolean> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
};

export const waitForHttpReady = async (url: string, label: string, maxWaitMs: number): Promise<void> => {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (await probeHttpReady(url, 2000)) {
      return;
    }
    await sleepMs(600);
  }
  throw new Error(`Timed out waiting for ${label} at ${url} after ${maxWaitMs}ms`);
};

const killProcessTree = (pid: number): void => {
  if (!pid || pid <= 0) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Ignore already exited processes.
  }
};

const spawnDetachedNpmScript = (scriptName: string): ChildProcess => {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(npmCmd, ['run', scriptName], {
    cwd: ENGINE_FRONTEND_DIR,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32'
  });
};

const cleanupSpawnedServers = async (
  pids: readonly number[],
  children: readonly ChildProcess[],
  wireServer: AnthropicWireServerHandle | null
): Promise<void> => {
  // Terminate the entire Windows process tree BEFORE signalling direct child handles,
  // otherwise killing cmd.exe first orphans nested npm/vite node processes.
  for (const pid of pids) {
    killProcessTree(pid);
  }
  for (const child of children) {
    try {
      child.kill('SIGKILL');
    } catch {
      // Ignore cleanup failure.
    }
  }
  if (wireServer) {
    await wireServer.close().catch((): void => {});
  }
};

export const ensureE2eServersReady = async (
  options: E2eServerOptions = {}
): Promise<E2eServersHandle> => {
  const includeResponder = options.includeResponder ?? false;
  const useWireServer = options.useWireServer ?? true;

  const pids: number[] = [];
  const children: ChildProcess[] = [];
  let wireServer: AnthropicWireServerHandle | null = null;

  const skipServerStart = process.env.SKIP_SERVER_START === '1';
  const backendAlreadyUp = await probeHttpReady(`${E2E_BACKEND_URL}/api/standby-ai/status`);
  const civilianAlreadyUp = await probeHttpReady(E2E_CIVILIAN_FRONTEND_URL);
  const responderAlreadyUp = !includeResponder || (await probeHttpReady(E2E_RESPONDER_FRONTEND_URL));

  if (skipServerStart) {
    console.log('[SERVER] SKIP_SERVER_START=1 detected -- using already-running servers.');
    return {
      wireServer: null,
      pids,
      stopAll: async (): Promise<void> => {}
    };
  }

  try {
    if (!backendAlreadyUp) {
      let wireEndpointEnv: string | undefined;
      if (useWireServer) {
        wireServer = await startAnthropicTestWireServer();
        wireEndpointEnv = wireServer.messagesEndpoint;
        console.log(`[SERVER] Started local Anthropic test wire server on ${wireEndpointEnv}`);
      }

      console.log(`[SERVER] Spawning temporary Backend server on ${E2E_BACKEND_URL}...`);
      const backendEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development'
      };
      if (wireEndpointEnv) {
        backendEnv.Claude__Endpoint = wireEndpointEnv;
        if (!backendEnv.Claude__ApiKey && !backendEnv.ANTHROPIC_API_KEY) {
          backendEnv.Claude__ApiKey = 'wire-local-e2e-test-key-0000';
        }
      }

      const backendProc = spawn(
        'dotnet',
        ['run', '--no-launch-profile', '--urls', E2E_BACKEND_URL],
        {
          cwd: ENGINE_BACKEND_DIR,
          env: backendEnv,
          stdio: 'ignore',
          detached: process.platform !== 'win32'
        }
      );
      children.push(backendProc);
      if (backendProc.pid) {
        pids.push(backendProc.pid);
      }
      await waitForHttpReady(`${E2E_BACKEND_URL}/api/standby-ai/status`, 'Backend API', 95000);
      console.log(`[SERVER] Backend ready at ${E2E_BACKEND_URL}`);
    } else {
      console.log(`[SERVER] Reusing live Backend at ${E2E_BACKEND_URL}`);
    }

    if (!civilianAlreadyUp) {
      console.log(`[SERVER] Spawning Civilian Vite frontend on ${E2E_CIVILIAN_FRONTEND_URL}...`);
      const civilianProc = spawnDetachedNpmScript('dev:civilian');
      children.push(civilianProc);
      if (civilianProc.pid) {
        pids.push(civilianProc.pid);
      }
      await waitForHttpReady(E2E_CIVILIAN_FRONTEND_URL, 'Civilian Frontend', 60000);
      console.log(`[SERVER] Civilian Frontend ready at ${E2E_CIVILIAN_FRONTEND_URL}`);
    } else {
      console.log(`[SERVER] Reusing live Civilian Frontend at ${E2E_CIVILIAN_FRONTEND_URL}`);
    }

    if (includeResponder && !responderAlreadyUp) {
      console.log(`[SERVER] Spawning Responder Vite frontend on ${E2E_RESPONDER_FRONTEND_URL}...`);
      const responderProc = spawnDetachedNpmScript('dev:responder');
      children.push(responderProc);
      if (responderProc.pid) {
        pids.push(responderProc.pid);
      }
      await waitForHttpReady(E2E_RESPONDER_FRONTEND_URL, 'Responder Frontend', 60000);
      console.log(`[SERVER] Responder Frontend ready at ${E2E_RESPONDER_FRONTEND_URL}`);
    }
  } catch (err: unknown) {
    await cleanupSpawnedServers(pids, children, wireServer);
    throw err;
  }

  return {
    wireServer,
    pids,
    stopAll: async (): Promise<void> => cleanupSpawnedServers(pids, children, wireServer)
  };
};
