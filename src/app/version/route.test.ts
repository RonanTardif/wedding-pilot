import { afterEach, describe, expect, it, vi } from "vitest";
import { dynamic, GET } from "./route";

describe("GET /version", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the deployed SHA from GIT_SHA", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    vi.stubEnv("GIT_SHA", sha);
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sha });
  });

  it("returns unknown when GIT_SHA is missing", async () => {
    vi.stubEnv("GIT_SHA", undefined);
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sha: "unknown" });
  });

  it("returns unknown when GIT_SHA is blank", async () => {
    vi.stubEnv("GIT_SHA", "  ");
    expect(await GET().json()).toEqual({ sha: "unknown" });
  });

  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(GET().headers.get("cache-control")).toBe("no-store");
  });
});
