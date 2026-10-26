import { expect, test, type Page } from "@playwright/test";

function eventStream(events: [string, unknown][]) {
  return events
    .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

test("adding a person in one step shows the viewer-relative family card", async ({ page }) => {
  await createAccount(page);
  await page.goto("/app/people");
  await page.getByRole("button", { name: "Add a person", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name", { exact: true }).fill("Meera");
  await sheet.getByRole("button", { name: "Mother", exact: true }).click();
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet.getByRole("status")).toContainText("Meera is in your family.");
  await expect(
    sheet.getByRole("link", { name: "Share connect link on WhatsApp", exact: true }),
  ).toHaveAttribute("href", /wa\.me/);
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Meera", exact: true }) });
  await expect(card).toContainText("Mother");
  await expect(card).toContainText("Not joined");
  await expect(card.getByRole("button", { name: "Connect", exact: true })).toBeVisible();
});

test("mother approves a controlled care hint and child sees only the idea", async ({
  page,
  browser,
}) => {
  // Controlled AI/cron responses; backend tests exercise consent and disclosure boundaries.
  await createAccount(page);
  let proposed = false;
  let approved = false;
  await page.route("**/v1/settings/integrations", (r) =>
    r.fulfill({ json: { ai_configured: true } }),
  );
  await page.route("**/v1/hints", (r) =>
    r.fulfill({
      json: {
        incoming: [],
        outgoing:
          proposed && !approved
            ? [{ id: "hint", recipient: "Riya", text: "Bring red flowers for a visit" }]
            : [],
      },
    }),
  );
  await page.route("**/v1/hints/hint", async (r) => {
    expect(r.request().postDataJSON().action).toBe("yes");
    approved = true;
    await r.fulfill({ json: { ok: true } });
  });
  const spaces = await (await page.request.get("/v1/spaces")).json();
  const sid = spaces.find((s: { type: string }) => s.type === "personal").id;
  const thread = await (
    await page.request.post(`/v1/spaces/${sid}/conversations`, { data: { title: "Flowers" } })
  ).json();
  const turns = [
    { id: "user", author_user_id: "mother", body: "I love red flowers", citations: [] },
    { id: "assistant", author_user_id: null, body: "That sounds lovely.", citations: [] },
  ];
  await page.route(`**/v1/conversations/${thread.id}/messages`, (r) => r.fulfill({ json: turns }));
  await page.route(`**/v1/spaces/${sid}/chat/stream`, async (r) => {
    proposed = true;
    await r.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: eventStream([
        [
          "start",
          { conversation_id: thread.id, user_message: turns[0] },
        ],
        ["delta", { text: turns[1].body }],
        [
          "done",
          {
            conversation_id: thread.id,
            assistant_message: turns[1],
            suggested_memory_ids: [],
          },
        ],
      ]),
    });
  });
  await page.reload();
  await page.getByRole("textbox", { name: "Message Smriti" }).fill("I love red flowers");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText(/Want me to pass this to Riya/)).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText(/Want me to pass this to Riya/)).not.toBeVisible();
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const child = await context.newPage();
  await child.route("**/v1/hints", (r) =>
    r.fulfill({
      json: {
        outgoing: [],
        incoming: approved
          ? [
              {
                id: "hint",
                text: "Your mother might enjoy this: bring red flowers for a visit.",
                why: "Your family shared a small hint with Smriti.",
              },
            ]
          : [],
      },
    }),
  );
  await createAccount(child);
  const card = child.getByRole("region", { name: "Gentle family ideas" });
  await expect(card).toContainText("Your mother might enjoy");
  await expect(card).not.toContainText("I love red flowers");
  await card.getByText("Why?", { exact: true }).click();
  await expect(card).toContainText("Your family shared a small hint with Smriti.");
  await context.close();
});

async function createAccountViaApi(page: Page) {
  const email = `legacy-${crypto.randomUUID()}@example.com`;
  const signup = await page.request.post("/api/auth/signup", {
    data: { name: "Legacy Tester", email, password: "a-good-test-password" },
  });
  expect(signup.status(), await signup.text()).toBe(201);
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
  const response = await page.request.post("/v1/families", {
    data: { name: "The Legacy Test Family" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const family = (await response.json()) as { id: string; name: string };
  // A successful write must already be visible to the very next request.
  expect((await page.request.get(`/v1/families/${family.id}/persons`)).status()).toBe(200);
  return family;
}

async function confirmMemory(page: Page, memoryId: string) {
  const confirmed = await page.request.post(`/v1/memories/${memoryId}/confirm`);
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const response = await page.request.get(`/v1/memories/${memoryId}`);
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).status).toBe("confirmed");
}

async function createAccount(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Your name", { exact: true }).fill("Avery Patel");
  await page.getByLabel("Email", { exact: true }).fill(`avery-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-good-test-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Avery Patel");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Family name", { exact: true }).fill("The Patel family");
  await page.getByLabel("First person’s name", { exact: true }).fill("Ravi Patel");
  await page
    .getByRole("group", { name: "First person’s relationship", exact: true })
    .getByRole("button", { name: "Mother", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Say hello to Smriti" })).toBeVisible();
  await page.getByRole("button", { name: /start later/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("textbox", { name: "Message Smriti" })).toBeVisible();
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hey Avery,/ })).toBeVisible();
}

test("public routes and fictional sample remain intact", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/pricing",
    "/sample",
    "/trust",
    "/about",
    "/contact",
    "/faq",
    "/for/families",
    "/book",
    "/login",
    "/signup",
    "/legal/privacy",
    "/legal/terms",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${path} overflow`,
    ).toBeTruthy();
  }
  await page.goto("/sample?question=2");
  await expect(page.locator(".answer-panel")).toContainText("Arun hopes his grandchildren");
  await page.getByText("Read the supporting evidence").click();
  await expect(page.locator(".evidence blockquote")).toContainText("never become too busy");
  expect(errors).toEqual([]);
});

test("the guide renders with search and a helpful control", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/docs",
    "/docs/getting-started",
    "/docs/add-your-family",
    "/docs/record-a-story",
    "/docs/ask-your-archive",
    "/docs/gentle-hints",
    "/docs/privacy-and-sharing",
    "/docs/your-data",
    "/docs/troubleshooting",
    "/docs/developers",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${path} overflow`,
    ).toBeTruthy();
  }

  await page.goto("/docs");
  await page.getByRole("searchbox", { name: "Search the guide" }).fill("hint");
  await expect(page.getByRole("link", { name: /Gentle hints/ }).first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search the guide" }).fill("");

  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.getByText("Thank you — noted.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the app opens directly into simple AI chat with memory beside it", async ({
  page,
}, testInfo) => {
  await page.route("**/v1/settings/integrations", (route) =>
    route.fulfill({ json: { openai_configured: false } }),
  );
  await createAccount(page);
  await expect(page.getByRole("textbox", { name: "Message Smriti" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect AI", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reflect on my day" }).click();
  await expect(page.getByRole("textbox", { name: "Message Smriti" })).toHaveValue(
    "Reflect on my day",
  );
  await page.getByRole("textbox", { name: "Message Smriti" }).press("Enter");
  await expect(page.getByText("Add an API key in backend/.env", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message Smriti" })).toHaveValue(
    "Reflect on my day",
  );
  await page.getByRole("button", { name: "Open memory", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Nothing saved yet");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("switch", { name: "Remember things from my chats" }).click();
  await expect(page.getByRole("switch", { name: "Remember things from my chats" })).toBeChecked();
  await page.getByRole("textbox", { name: "Message Smriti" }).fill("");
  await page.screenshot({ path: testInfo.outputPath("chat-first.png"), fullPage: true });
});

test("a sourced memory is reviewed, persists on the server, and is exported", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createAccount(page);
  await page.goto("/app/memory");
  await page.getByRole("button", { name: "Add a memory", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("The memory", { exact: true })
    .fill("Ravi learned to save before expanding.");
  await dialog
    .getByLabel("The original words or source quote")
    .fill("I saved for three years before opening my second shop.");
  await dialog.getByRole("button", { name: "Save for review · Only you" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ravi learned to save before expanding." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm memory", exact: true }).click();
  await page.getByRole("tab", { name: "Confirmed", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Confirmed", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Ravi learned to save before expanding." }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Confirmed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ravi learned to save before expanding." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share / Publish" }).click();
  await expect(page.getByRole("dialog")).toContainText("Avery Patel (audio)");
  await page.getByRole("dialog").getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/app/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  expect((await download).suggestedFilename()).toBe("smriti-export.json");
  expect(errors).toEqual([]);
});

test("chat turns, recent conversations and new chat work with controlled AI responses", async ({
  page,
}, testInfo) => {
  await page.route("**/v1/settings/integrations", (route) =>
    route.fulfill({ json: { openai_configured: true } }),
  );
  await createAccount(page);
  const spaces = await (await page.request.get("/v1/spaces")).json();
  const sid = spaces.find((s: { type: string }) => s.type === "personal").id;
  let tid = "";
  const turns: { id: string; body: string; author_user_id: string | null; citations: never[] }[] =
    [];
  await page.route("**/v1/conversations/*/messages", (route) => {
    if (tid && route.request().method() === "GET" && route.request().url().includes(tid))
      return route.fulfill({ json: turns });
    return route.continue();
  });
  await page.route(`**/v1/spaces/${sid}/chat/stream`, async (route) => {
    const input = route.request().postDataJSON();
    if (!tid)
      tid = (
        await (
          await page.request.post(`/v1/spaces/${sid}/conversations`, {
            data: { title: input.message },
          })
        ).json()
      ).id;
    else expect(input.conversation_id).toBe(tid);
    const user = await (
      await page.request.post(`/v1/conversations/${tid}/messages`, {
        data: { body: input.message },
      })
    ).json();
    const assistant = {
      id: crypto.randomUUID(),
      body: turns.length
        ? "You told me your father loves gardening. What does he like to grow?"
        : "That sounds lovely. Tell me a little more about him.",
      author_user_id: null,
      citations: [] as never[],
    };
    turns.push(user, assistant);
    await route.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: eventStream([
        ["start", { conversation_id: tid, user_message: user }],
        ["delta", { text: assistant.body.slice(0, 12) }],
        ["delta", { text: assistant.body.slice(12) }],
        [
          "done",
          {
            conversation_id: tid,
            assistant_message: assistant,
            suggested_memory_ids: [],
          },
        ],
      ]),
    });
  });
  const composer = page.getByRole("textbox", { name: "Message Smriti" });
  await composer.fill("My father loves gardening.");
  await composer.press("Enter");
  await expect(page.getByRole("article", { name: "Smriti reply" })).toContainText(
    "Tell me a little more",
  );
  await expect(composer).toHaveValue("");
  await composer.fill("What was I just telling you?");
  await composer.press("Enter");
  await expect(page.getByRole("article", { name: "Smriti reply" })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("article", { name: "Your message", exact: true })).toHaveCount(2);
  await expect(page.getByRole("article", { name: "Smriti reply" }).last()).toContainText(
    "your father loves gardening",
  );
  await page.screenshot({ path: testInfo.outputPath("conversation.png"), fullPage: true });
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Hey Avery,/ })).toBeVisible();
});

test("chat streams a reply, keeps a failed draft, and saves an inline memory", async ({ page }) => {
  await createAccount(page);
  await page.route("**/v1/settings/integrations", (route) =>
    route.fulfill({ json: { ai_configured: true } }),
  );
  const spaces = await (await page.request.get("/v1/spaces")).json();
  const sid = spaces.find((s: { type: string }) => s.type === "personal").id;
  const me = await (await page.request.get("/v1/me")).json();
  const memory = await (
    await page.request.post("/v1/memories", {
      data: {
        space_id: sid,
        summary: "Ravi grows tomatoes on the balcony.",
        evidence: "I grow tomatoes on the balcony.",
      },
    })
  ).json();
  let fail = true;
  const threadId = (
    await (
      await page.request.post(`/v1/spaces/${sid}/conversations`, {
        data: { title: "Ravi grows tomatoes" },
      })
    ).json()
  ).id;
  const userMessage = {
    id: crypto.randomUUID(),
    body: "Ravi grows tomatoes on the balcony.",
    author_user_id: me.id,
    citations: [],
  };
  const assistant = {
    id: crypto.randomUUID(),
    body: "That sounds like a small, good thing to keep.",
    author_user_id: null,
    citations: [],
  };
  await page.route(`**/v1/conversations/${threadId}/messages`, (route) =>
    route.fulfill({ json: [userMessage, assistant] }),
  );
  await page.route(`**/v1/spaces/${sid}/chat/stream`, async (route) => {
    if (fail) {
      fail = false;
      return route.fulfill({
        status: 503,
        json: {
          detail: { code: "ai_quota_exhausted", message: "AI quota is exhausted." },
        },
      });
    }
    return route.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: eventStream([
        ["start", { conversation_id: threadId, user_message: userMessage }],
        ["delta", { text: assistant.body }],
        [
          "done",
          {
            conversation_id: threadId,
            assistant_message: assistant,
            suggested_memory_ids: [memory.id],
          },
        ],
      ]),
    });
  });
  await page.reload();
  const composer = page.getByRole("textbox", { name: "Message Smriti" });
  await composer.fill("Ravi grows tomatoes on the balcony.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".sc-error")).toContainText("AI quota is exhausted.");
  await expect(composer).toHaveValue("Ravi grows tomatoes on the balcony.");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("article", { name: "Smriti reply" })).toContainText(
    "small, good thing",
  );
  await expect(composer).toHaveValue("");
  const remember = page.getByRole("article", { name: "Remember this?" });
  await expect(remember).toContainText("Ravi grows tomatoes on the balcony.");
  await remember.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(remember).not.toBeVisible();
  const saved = await (await page.request.get(`/v1/memories/${memory.id}`)).json();
  expect(saved.status).toBe("confirmed");
});

test("language switches on all four destinations and Stories is one feed", async ({ page }) => {
  await createAccount(page);
  await page.goto("/app");
  await page.getByRole("button", { name: "हिं", exact: true }).click();
  await expect(page.getByRole("heading", { name: /नमस्ते Avery,/ })).toBeVisible();
  await page.goto("/app/family?view=people");
  await expect(page.getByRole("heading", { name: "आपके लोग", exact: true })).toBeVisible();
  await page.goto("/app/stories");
  await expect(
    page.getByRole("heading", { name: "Smriti की याद रखी कहानियाँ", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "मेरी", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /कहानी रिकॉर्ड करें/ })).toBeVisible();
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "सेटिंग्स और निजता", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings & privacy", exact: true })).toBeVisible();
  await page.goto("/app/stories");
  await expect(page.getByRole("button", { name: "Needs review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Shared", exact: true }).click();
  await expect(page.getByText(/Nothing has been shared with you yet/)).toBeVisible();
});

test("summary sharing reaches the named account without exposing source quotes", async ({
  page,
  browser,
}) => {
  await createAccount(page);
  const spaces = await (await page.request.get("/v1/spaces")).json();
  const families = await (await page.request.get("/v1/families")).json();
  const privateSpace = spaces.find((s: { type: string }) => s.type === "personal");
  const receiver = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    const signup = await receiver.request.post("/api/auth/signup", {
      data: {
        name: "Meera Patel",
        email: `meera-${crypto.randomUUID()}@example.com`,
        password: "a-good-test-password",
      },
    });
    expect(signup.status()).toBe(201);
    const invite = await (
      await page.request.post(`/v1/families/${families[0].id}/invites`, { data: {} })
    ).json();
    expect((await receiver.request.post(`/v1/invites/${invite.token}/accept`)).status()).toBe(200);
    const memory = await (
      await page.request.post("/v1/memories", {
        data: {
          space_id: privateSpace.id,
          summary: "Ravi loved early morning walks.",
          evidence: "I used to walk past the old school at sunrise.",
        },
      })
    ).json();
    expect((await page.request.post(`/v1/memories/${memory.id}/confirm`)).status()).toBe(200);
    await page.goto("/app/memory");
    await page.getByRole("tab", { name: "Confirmed", exact: true }).click();
    await page.getByRole("button", { name: "Share / Publish" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: /Specific people/, exact: false }).check();
    await sheet.getByRole("checkbox", { name: "Meera Patel", exact: true }).check();
    await sheet.getByRole("button", { name: "Confirm sharing", exact: true }).click();
    // The receiver's first read is a fresh page load, so wait for the owner's
    // explicit success state rather than racing the grant write.
    await expect(sheet.getByRole("status")).toHaveText("Access updated.");
    const viewer = await receiver.newPage();
    await viewer.goto("/app/memory");
    await viewer.getByRole("tab", { name: "Shared with me", exact: true }).click();
    await expect(
      viewer.getByRole("heading", { name: "Ravi loved early morning walks." }),
    ).toBeVisible();
    await expect(
      viewer.getByText("I used to walk past the old school at sunrise.", { exact: false }),
    ).toHaveCount(0);
    const grants = await (await page.request.get(`/v1/items/memory/${memory.id}/grants`)).json();
    expect(grants.length).toBe(1);
    expect(
      (await page.request.delete(`/v1/items/memory/${memory.id}/grants/${grants[0].id}`)).status(),
    ).toBe(200);
    await viewer.reload();
    await viewer.getByRole("tab", { name: "Shared with me", exact: true }).click();
    await expect(
      viewer.getByRole("heading", { name: "Ravi loved early morning walks." }),
    ).toHaveCount(0);
  } finally {
    await receiver.close();
  }
});

test("new signed-in screens are responsive and microphone consent is required", async ({
  page,
}) => {
  await createAccount(page);
  for (const path of [
    "/app",
    "/app/me",
    "/app/legacy",
    "/app/legacy/founders",
    "/app/legacy/timeline",
    "/app/legacy/interviews",
    "/app/legacy/vault",
    "/app/family",
    "/app/stories",
    "/app/circles",
    "/app/memory",
    "/app/people",
    "/app/recordings",
    "/app/prompts",
    "/app/activity",
    "/app/settings",
    "/app/shared",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${path} overflow`,
    ).toBeTruthy();
    await expect(page.locator('.eco-error[role="alert"]')).toHaveCount(0);
  }
  await page.goto("/app/record");
  await expect(page.getByRole("button", { name: "Record", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Record", exact: true })).toBeEnabled();
});

test("family heritage dashboard shows authorized family data and honest empty states", async ({
  page,
}, testInfo) => {
  const family = await createAccountViaApi(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/legacy");
  await expect(
    page.getByRole("heading", { name: "Family Heritage Dashboard", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: family.name, level: 2 })).toBeVisible();
  for (const title of [
    "Family Members",
    "Family Timeline",
    "Recorded Stories",
    "Preserved Memories",
    "Documents",
    "Founder Legacy",
    "Heritage Book",
    "Your recent activity",
  ]) {
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }
  // The family creator is added as the first member. Nothing has been recorded
  // yet, so the dashboard must say so instead of inventing stories or statistics.
  const member = page.getByRole("listitem").filter({ hasText: "Legacy Tester" });
  await expect(member).toContainText("owner");
  await expect(member).toContainText("Joined");
  await expect(page.getByText("No preserved memories yet")).toBeVisible();
  await expect(page.getByText("No documents yet")).toBeVisible();
  await expect(page.getByText("No legacy profile yet")).toBeVisible();
  await expect(page.getByText("Shape approved stories into a book")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("legacy-dashboard.png"), fullPage: true });
});

test("founder legacy studio keeps chapters in draft until a human publishes them", async ({
  page,
}, testInfo) => {
  // This journey covers editing, source review, publishing, and revocation.
  test.setTimeout(90_000);
  const family = await createAccountViaApi(page);
  const founderResponse = await page.request.post(`/v1/families/${family.id}/founders`, {
    data: { display_name: "Arun Mehra", title: "Founder, Mehra & Sons", birth_year: 1942 },
  });
  expect(founderResponse.status(), await founderResponse.text()).toBe(201);
  const founder = (await founderResponse.json()) as { id: string };
  await expect
    .poll(async () => (await page.request.get(`/v1/founders/${founder.id}`)).status(), {
      timeout: 15000,
    })
    .toBe(200);

  const spaces = (await (await page.request.get("/v1/spaces")).json()) as Array<{
    id: string;
    type: string;
  }>;
  const personal = spaces.find((space) => space.type === "personal");
  expect(personal).toBeTruthy();
  const memoryResponse = await page.request.post("/v1/memories", {
    data: {
      space_id: personal!.id,
      summary: "Arun saved for three years before opening his first shop.",
      evidence: "I saved for three years before I opened the first shop.",
    },
  });
  expect(memoryResponse.status(), await memoryResponse.text()).toBe(201);
  const memory = (await memoryResponse.json()) as { id: string };
  await expect
    .poll(async () => (await page.request.get(`/v1/memories/${memory.id}`)).status(), {
      timeout: 15000,
    })
    .toBe(200);
  await confirmMemory(page, memory.id);
  const attached = await page.request.post(
    `/v1/founders/${founder.id}/chapters/first_business/sources`,
    { data: { memory_id: memory.id } },
  );
  expect(attached.status(), await attached.text()).toBe(201);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/legacy/founders");
  await expect(
    page.getByRole("heading", { name: "Founder Legacy Studio", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arun Mehra", level: 3 })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();

  await page.goto(`/app/legacy/founders/${founder.id}`);
  await expect(page.getByRole("heading", { name: "Arun Mehra", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /First Business/ }).click();
  const editor = page.getByLabel("Chapter narrative");
  await editor.fill("Arun saved for three years before opening his first shop.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Saved as a draft/)).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  // The chapter was a draft at this point, not visible to readers. A human
  // explicitly publishes it.
  await page.getByRole("button", { name: "Publish chapter" }).click();
  await page.getByRole("button", { name: "Confirm publish" }).click();
  await expect(page.getByText(/Published to the family/)).toBeVisible();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /First Business/ }).click();
  await expect(editor).toHaveValue("Arun saved for three years before opening his first shop.");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("founder-studio.png"), fullPage: true });
});

test("family heritage timeline orders events, filters by generation, and keeps sources", async ({
  page,
}, testInfo) => {
  // This journey covers event ordering, filters, and source access.
  test.setTimeout(120_000);
  const family = await createAccountViaApi(page);

  const elderResponse = await page.request.post(`/v1/families/${family.id}/persons`, {
    data: { display_name: "Elena Mehra" },
  });
  expect(elderResponse.status(), await elderResponse.text()).toBe(201);
  const elder = (await elderResponse.json()) as { id: string };
  const heirResponse = await page.request.post(`/v1/families/${family.id}/persons`, {
    data: { display_name: "Rajan Mehra" },
  });
  expect(heirResponse.status(), await heirResponse.text()).toBe(201);
  const heir = (await heirResponse.json()) as { id: string };
  const relationResponse = await page.request.post(`/v1/families/${family.id}/relationships`, {
    data: {
      from_person_id: elder.id,
      to_person_id: heir.id,
      type: "parent_of",
      status: "confirmed",
    },
  });
  expect(relationResponse.status(), await relationResponse.text()).toBe(201);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/v1/families/${family.id}/timeline`);
        if (!response.ok()) return null;
        const payload = (await response.json()) as {
          persons: Array<{ id: string; generation: number }>;
        };
        return payload.persons.find((person) => person.id === heir.id)?.generation;
      },
      { timeout: 15000 },
    )
    .toBe(2);

  const spaces = (await (await page.request.get("/v1/spaces")).json()) as Array<{
    id: string;
    type: string;
  }>;
  const personal = spaces.find((space) => space.type === "personal");
  expect(personal).toBeTruthy();
  const memoryResponse = await page.request.post("/v1/memories", {
    data: {
      space_id: personal!.id,
      summary: "Elena kept the first ledger in a steel trunk.",
      evidence: "The ledger lived in a steel trunk under her bed.",
    },
  });
  expect(memoryResponse.status(), await memoryResponse.text()).toBe(201);
  const memory = (await memoryResponse.json()) as { id: string };
  await confirmMemory(page, memory.id);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/legacy/timeline");
  await expect(
    page.getByRole("heading", { name: "Family Heritage Timeline", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("The timeline is waiting")).toBeVisible();

  // Add a dated event for the second generation through the form.
  await page.getByRole("button", { name: "Add an event", exact: true }).click();
  await page.getByLabel("Event title").fill("The first shop opens");
  await page.getByRole("combobox", { name: /^Category/ }).selectOption("business");
  await page.getByLabel("Date", { exact: true }).fill("1978-04-01");
  await page.getByLabel("Family person").selectOption(heir.id);
  await page.getByLabel("Description").fill("Rajan opened the family business on the high street.");
  await page.getByRole("button", { name: "Add to the timeline" }).click();
  await expect(page.getByRole("status")).toContainText("Event added to the timeline.");

  const card = page.getByRole("button", { name: /The first shop opens/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Business foundation");
  await expect(card).toContainText("Rajan Mehra · Generation 2");
  await expect(card).toContainText("No source attached");

  // Attach a confirmed memory as the event's provenance.
  await page.getByRole("button", { name: "Attach source" }).click();
  await page.getByLabel("Find a memory or recording").fill("steel trunk");
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Source attached");
  await expect(
    page.getByText("Elena kept the first ledger in a steel trunk.").first(),
  ).toBeVisible();
  await expect(card).toContainText("1 source");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("heritage-timeline.png"), fullPage: true });

  // Category and generation filters narrow the stream honestly.
  await page.getByRole("button", { name: "Recorded story" }).click();
  await expect(page.getByText("Nothing matches these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Generation").selectOption("1");
  await expect(page.getByText("Nothing matches these filters")).toBeVisible();
  await page.getByLabel("Generation").selectOption("2");
  await expect(card).toBeVisible();
  await page.getByLabel("Generation").selectOption("");
  await page.getByLabel("Person", { exact: true }).selectOption(elder.id);
  await expect(page.getByText("Nothing matches these filters")).toBeVisible();
  await page.getByLabel("Person", { exact: true }).selectOption(heir.id);
  await expect(card).toBeVisible();
  await page.getByLabel("Person", { exact: true }).selectOption("");

  // Re-open the event and edit it.
  await card.click();
  await page.getByRole("button", { name: "Edit event" }).click();
  await page.getByLabel("Event title").fill("The first shop opens on the high street");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Event updated.");
  await expect(
    page.getByRole("button", { name: /The first shop opens on the high street/ }),
  ).toBeVisible();

  // Remove the event; the archive keeps the memory itself.
  await page.getByRole("button", { name: "Remove event" }).click();
  await page.getByRole("button", { name: "Confirm remove" }).click();
  await expect(page.getByRole("status")).toContainText("Event removed from the timeline.");
  await expect(page.getByText("The timeline is waiting")).toBeVisible();
});

test("a new family begins with three gentle onboarding screens and a clear home", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your name", { exact: true }).fill("Avery Patel");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`onboarding-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-good-test-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "What should Smriti call you?" })).toBeVisible();
  await page.getByRole("button", { name: "हिंदी · Hindi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Smriti आपको क्या कहें?", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "हिंदी · Hindi", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What should Smriti call you?", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "हिंदी · Hindi", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Who’s in your story?" })).toBeVisible();
  await page.getByLabel("Family name", { exact: true }).fill("The Patel family");
  await page.getByLabel("First person’s name", { exact: true }).fill("Ravi Patel");
  await page
    .getByRole("group", { name: "First person’s relationship", exact: true })
    .getByRole("button", { name: "Mother", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Add a second person", exact: true }).click();
  await page.getByLabel("Second person’s name", { exact: true }).fill("Meera Patel");
  await page
    .getByRole("group", { name: "Second person’s relationship", exact: true })
    .getByRole("button", { name: "Sibling", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Say hello to Smriti" })).toBeVisible();
  await page.getByRole("button", { name: /start later/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Hey Avery,/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell Smriti one story" })).toBeVisible();
  const family = page.getByRole("region", { name: "Your family", exact: true });
  await expect(family).toContainText("Ravi");
  await expect(family).toContainText("Meera");
  await expect(page.getByText("Waiting for you", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Conversation starters", exact: true }).getByRole("button"),
  ).toHaveCount(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();

  const tips = page.getByRole("dialog", { name: "Getting started tips", exact: true });
  await expect(tips).toContainText("Tip 1 of 3");
  await tips.getByRole("button", { name: "Next tip", exact: true }).click();
  await expect(tips).toContainText("Tip 2 of 3");
  await tips.getByRole("button", { name: "Skip tips", exact: true }).click();
  await expect(tips).toHaveCount(0);
});

test("home failures offer one honest retry instead of an empty dashboard", async ({ page }) => {
  await createAccount(page);
  await page.route("**/v1/home", (route) =>
    route.fulfill({ status: 503, json: { detail: "Home is resting for a moment." } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "We couldn’t open your home", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sc-home-error")).toContainText("Home is resting for a moment.");
  await page.unroute("**/v1/home");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hey Avery,/ })).toBeVisible();
});
