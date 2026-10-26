import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      name: "Interview Tester",
      email: `interview-${crypto.randomUUID()}@example.com`,
      password: "a-good-test-password",
    },
  });
  expect(signup.status()).toBe(201);
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
  const created = await page.request.post("/v1/families", { data: { name: "Interview Family" } });
  expect(created.status()).toBe(201);
  const family = (await created.json()) as { id: string };
  await expect
    .poll(async () => (await page.request.get(`/v1/families/${family.id}/persons`)).status(), {
      timeout: 15000,
    })
    .toBe(200);
  const people = await (await page.request.get(`/v1/families/${family.id}/persons`)).json();
  return { familyId: family.id, personId: people[0].id as string };
}

test("legacy interview uses existing consent recorder and saves a manual summary without AI", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const { personId } = await setup(page);
  await page.goto("/app/legacy/interviews");
  await expect(page.getByRole("heading", { name: "AI Legacy Interviews" })).toBeVisible();
  await page.getByLabel("Interview title").fill("Childhood at home");
  await page.getByLabel("Interview subject", { exact: true }).selectOption(personId);
  await page.getByLabel("Interview theme", { exact: true }).selectOption("childhood");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page).toHaveURL(/\/app\/legacy\/interviews\/[a-z0-9]+$/);
  const interviewUrl = page.url();
  const interviewId = interviewUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Childhood at home" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "What is your earliest happy memory?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Record response", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recording studio" })).toBeVisible();
  const record = page.getByRole("button", { name: "Record", exact: true });
  await expect(record).toBeDisabled();
  await expect(page.getByRole("combobox", { name: /^Who is speaking/ })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(record).toBeEnabled();
  await page.getByLabel("Give this recording a title").fill("An afternoon in the garden");
  await record.click();
  await expect(page.getByText("0:01", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Save and process recording" }).click();
  await expect(page).toHaveURL(interviewUrl);
  await expect(page.getByText("An afternoon in the garden", { exact: true })).toBeVisible();
  const detail = await (await page.request.get(`/v1/interviews/${interviewId}`)).json();
  expect(detail.responses).toHaveLength(1);
  const recording = await (
    await page.request.get(`/v1/recordings/${detail.responses[0].recording_id}`)
  ).json();
  expect(recording.auto_extract).toBe(false);
  await page.getByLabel("Editable summary").fill("A manual draft to revisit with the family.");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/v1/interviews/${interviewId}`) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save summary", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel("Editable summary")).toHaveValue(
    "A manual draft to revisit with the family.",
  );
  const memories = await (
    await page.request.get(`/v1/memories?space_id=${detail.space_id}&tab=suggested`)
  ).json();
  expect(memories).toHaveLength(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("legacy-interview.png"), fullPage: true });
});

test("interview AI proposals require transcript review and explicit memory creation", async ({
  page,
}) => {
  const { familyId, personId } = await setup(page);
  const created = await page.request.post(`/v1/families/${familyId}/interviews`, {
    data: { title: "Values conversation", subject_person_id: personId, theme: "family_values" },
  });
  expect(created.status()).toBe(201);
  const interview = await created.json();
  // Controlled provider/transcription responses; backend tests exercise the real
  // recording pipeline, exact quote validation, consent withdrawal, and ownership.
  await page.route(`**/v1/interviews/${interview.id}`, (route) =>
    route.fulfill({
      json: {
        ...interview,
        responses: [
          {
            id: "response",
            available: true,
            question: "Which values guided you?",
            recording_id: "recording",
            title: "Values",
            status: "ready",
          },
        ],
      },
    }),
  );
  await page.route("**/v1/recordings/recording/transcript", (route) =>
    route.fulfill({
      json: [
        {
          id: "segment",
          recording_id: "recording",
          text: "We always helped our neighbours.",
          edited_text: null,
          start_ms: 0,
          end_ms: 1000,
        },
      ],
    }),
  );
  await page.route(`**/v1/interviews/${interview.id}/assist`, (route) =>
    route.fulfill({
      json: {
        summary: "Helping neighbours was important.",
        source_fingerprint: interview.source_fingerprint,
        followups: ["Who taught you to help?"],
        candidates: [
          {
            segment_id: "segment",
            quote: "We always helped our neighbours.",
            summary: "The family helped neighbours.",
          },
        ],
        draft: true,
      },
    }),
  );
  let memoriesCreated = 0;
  await page.route(`**/v1/interviews/${interview.id}/memories`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.reviewed).toBe(true);
    expect(body.segment_id).toBe("segment");
    expect(body.summary).toBe("Helping neighbours was a family value.");
    memoriesCreated += 1;
    await route.fulfill({ status: 201, json: { id: "reviewed-memory", status: "suggested" } });
  });
  await page.goto(`/app/legacy/interviews/${interview.id}`);
  await page.getByRole("button", { name: "Draft summary & follow-ups" }).click();
  await expect(page.getByLabel("Editable summary")).toHaveValue(
    "Helping neighbours was important.",
  );
  await expect(page.getByRole("button", { name: "Who taught you to help?" })).toBeVisible();
  expect(memoriesCreated).toBe(0);
  await page.getByRole("button", { name: "Review excerpts" }).click();
  await expect(page.getByRole("blockquote")).toHaveText("We always helped our neighbours.");
  const create = page.getByRole("button", { name: "Create reviewed memory" });
  await expect(create).toBeDisabled();
  await page.getByLabel("Memory summary").fill("Helping neighbours was a family value.");
  await page.getByRole("checkbox").check();
  await expect(create).toBeEnabled();
  expect(memoriesCreated).toBe(0);
  await create.click();
  await expect(page.getByText(/Private suggested memory created/)).toBeVisible();
  expect(memoriesCreated).toBe(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
