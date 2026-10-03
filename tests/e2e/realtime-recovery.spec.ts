import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test("Council reports database stream failure and refreshes immediately on recovery", async ({ page }) => {
  let sendSystem: ((status: "error" | "ok") => void) | undefined;
  let streamReady = false;
  let joinedWithSession = false;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (typeof message === "string") {
        const frame = JSON.parse(message);
        if (Array.isArray(frame) && frame[2]?.startsWith("realtime:council:") && frame[3] === "phx_join") {
          // Record only this boolean, never the token, in test evidence.
          const token = frame[4]?.access_token;
          joinedWithSession = typeof token === "string" &&
            JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role === "authenticated";
        }
      }
      server.send(message);
    });
    server.onMessage((message) => {
      // Retain the real authenticated transport; inject only service health
      // events after the database subscription has actually become ready.
      if (typeof message === "string") {
        const frame = JSON.parse(message);
        if (Array.isArray(frame) && frame[2]?.startsWith("realtime:council:")) {
          const [joinRef, , topic, event, payload] = frame;
          if (event === "system" && payload.extension === "postgres_changes" && payload.status === "ok") {
            streamReady = true;
            sendSystem = (status) => socket.send(JSON.stringify([
              joinRef, null, topic, "system",
              { extension: "postgres_changes", status, message: "Synthetic service health event", channel: topic },
            ]));
          }
        }
      }
      socket.send(message);
    });
  });
  await signIn(page);
  await page.goto("/council");
  await page.getByRole("link", { name: /^General / }).click();
  await expect.poll(() => joinedWithSession).toBe(true);
  await expect.poll(() => streamReady).toBe(true);
  sendSystem!("error");
  const warning = page.getByRole("status").filter({ hasText: "Reconnecting" });
  await expect(warning).toBeVisible();
  const refreshed = page.waitForRequest((request) =>
    request.method() === "GET" && request.url().includes("/council/") && request.headers().rsc === "1"
  );
  sendSystem!("ok");
  await refreshed;
  await expect(warning).toBeHidden();
});
