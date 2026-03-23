// Thin wrapper around Guardian REST API
// Used by guardian-setup.ts and guardian-populate.ts

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const DEFAULT_BASE_URL = process.env.GUARDIAN_API_URL || "http://195.201.8.147:3100";

export class GuardianClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async login(username: string, password: string): Promise<string> {
    // Step 1: Login returns a refreshToken (not an accessToken)
    const loginRes = await fetch(`${this.baseUrl}/api/v1/accounts/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    const loginData = (await loginRes.json()) as { refreshToken: string };
    this.refreshToken = loginData.refreshToken;

    // Step 2: Exchange refreshToken for accessToken
    const tokenRes = await fetch(`${this.baseUrl}/api/v1/accounts/access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    const tokenData = (await tokenRes.json()) as { accessToken: string };
    this.accessToken = tokenData.accessToken;
    return this.accessToken;
  }

  async register(
    username: string,
    password: string,
    role: "STANDARD_REGISTRY" | "USER"
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/accounts/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, password_confirmation: password, role }),
    });
    if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  }

  private authHeaders(): Record<string, string> {
    if (!this.accessToken) throw new Error("Not logged in");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${endpoint} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`PUT ${endpoint} failed: ${res.status} ${await res.text()}`);
    // PUT /profiles/{username} returns 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async delete(endpoint: string): Promise<void> {
    if (!this.accessToken) throw new Error("Not logged in");
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed: ${res.status} ${await res.text()}`);
  }

  async deleteAsync(endpoint: string, maxWaitMs = 600_000): Promise<void> {
    if (!this.accessToken) throw new Error("Not logged in");
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed: ${res.status} ${await res.text()}`);
    if (res.status === 204) return;
    const task = (await res.json()) as { taskId: string };
    await this.waitForTask(task.taskId, maxWaitMs);
  }

  async waitForTask(taskId: string, maxWaitMs = 600_000): Promise<unknown> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const task = await this.get<{
        taskId: string;
        expectation: number;
        result: unknown;
        error: unknown;
        statuses: Array<{ message: string; type: string }>;
      }>(`/api/v1/tasks/${taskId}`);
      // Task is done when result is set (non-null)
      if (task.result !== undefined && task.result !== null) {
        // Check if result indicates validation failure (publish tasks)
        const r = task.result as Record<string, unknown>;
        if (r.isValid === false) {
          const errObj = r.errors as { errors?: string[]; blocks?: Array<{ id: string; name: string; errors: string[] }> } | undefined;
          const errList = errObj?.errors?.slice(0, 5).join("; ") || "";
          const blockErrors = errObj?.blocks
            ?.filter((b) => b.errors?.length > 0)
            .slice(0, 5)
            .map((b) => `${b.name || b.id}: ${b.errors.join(", ")}`)
            .join("; ") || "";
          throw new Error(`Task ${taskId} validation failed: ${errList || blockErrors || JSON.stringify(r.errors).slice(0, 500)}`);
        }
        return task.result;
      }
      // Task failed if error is set
      if (task.error !== undefined && task.error !== null) {
        throw new Error(`Task ${taskId} failed: ${JSON.stringify(task.error)}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
      process.stdout.write(".");
    }
    throw new Error(`Task ${taskId} timed out after ${maxWaitMs}ms`);
  }

  // Async POST that returns a task ID, then polls for completion
  async postAsync<T>(endpoint: string, body: unknown, maxWaitMs = 180_000): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${endpoint} failed: ${res.status} ${await res.text()}`);
    const task = (await res.json()) as { taskId: string };
    const result = await this.waitForTask(task.taskId, maxWaitMs);
    return result as T;
  }

  // Async PUT that returns a task ID, then polls for completion
  async putAsync<T>(endpoint: string, body?: unknown, maxWaitMs = 180_000): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`PUT ${endpoint} failed: ${res.status} ${await res.text()}`);
    if (res.status === 204) return undefined as T;
    const task = (await res.json()) as { taskId: string };
    const result = await this.waitForTask(task.taskId, maxWaitMs);
    return result as T;
  }
}
