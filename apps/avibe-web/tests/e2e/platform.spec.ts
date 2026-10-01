import { test, expect } from "@playwright/test";
test("current public visual leads into the functional catalog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "找到，让故事发生的人。" }),
  ).toBeVisible();
  await expect(page.locator(".hero-art .art-mark")).toHaveText("✳");
  await page.screenshot({
    path: "test-results/desktop-landing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(
    page.getByRole("heading", { name: "Find the face of your next story." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Discover characters" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  await page.getByRole("button", { name: "Casting boards" }).click();
  await expect(page).toHaveURL(/\/boards$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/discover$/);
});
test("current public visual remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "找到，让故事发生的人。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-landing.png",
    fullPage: true,
  });
});
test("discovery, bilingual filtering and a verified character detail", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { name: "找到，让故事发生的人。" }),
  ).toBeVisible();
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  await page.screenshot({
    path: "test-results/desktop-discovery.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(
    page.getByRole("heading", { name: /Find the face/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Age from").fill("90");
  await expect(page.getByText("No exact matches yet")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".cast-card")).toHaveCount(8);
});
test("demo login, boards and package download", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  await page.getByRole("button", { name: "我的账号", exact: true }).click();
  await page.getByRole("button", { name: "进入本地演示" }).click();
  await expect(page.getByText("欢迎来到 avibe", { exact: true })).toBeVisible();
  await page.locator(".card-name").first().click();
  await expect(page).toHaveURL(/\/characters\/[^/]+$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "造型与角色卡" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "造型与角色卡" }).click();
  await expect(page.locator(".asset-previews img")).toHaveCount(4);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载角色包", exact: true }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toContain("lin-yue");
  await page.getByRole("button", { name: "选角", exact: true }).click();
  await page.getByLabel("项目名称").fill("验收短剧");
  await page.getByLabel("剧本中的身份").fill("女主");
  await page.getByRole("button", { name: "保存到选角板" }).click();
  await expect(page.getByText("已加入选角板", { exact: true })).toBeVisible();
});
test("private draft and disabled unconfigured generation", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  await page.getByRole("button", { name: "我的账号", exact: true }).click();
  await page.getByRole("button", { name: "进入本地演示" }).click();
  await page.getByRole("button", { name: "创建达人", exact: true }).click();
  await page.getByLabel("中文姓名").fill("测试角色");
  await page.getByLabel("英文姓名").fill("Test Character");
  await page.getByLabel("性格与气质").fill("温柔");
  await page.getByRole("button", { name: "保存人设，查看生成报价" }).click();
  await expect(page.getByRole("button", { name: "确认并生成" })).toBeDisabled();
});
test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-discovery.png",
    fullPage: true,
  });
});

test("mobile collaboration and wardrobe flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await expect(page.locator(".cast-card")).toHaveCount(8, { timeout: 60000 });
  await page.getByRole("button", { name: "我的账号", exact: true }).click();
  await page.getByRole("button", { name: "进入本地演示" }).click();
  await expect(page.getByText("欢迎来到 avibe", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "林悦", exact: true }).click();
  await page.getByRole("button", { name: "造型与角色卡" }).click();
  await expect(page.locator(".asset-previews img")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-character.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "寻求品牌合作" }).click();
  await page
    .getByPlaceholder("分享你的合作想法…")
    .fill("本地验收：讨论虚构短剧合作");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(
    page.locator(".message-bubble").getByText("本地验收：讨论虚构短剧合作"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-chat.png",
    fullPage: true,
  });
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "发现", exact: true })
    .click();
  await page.getByRole("button", { name: "林悦", exact: true }).click();
  await page.getByRole("button", { name: "试试新造型" }).click();
  await expect(
    page.getByRole("heading", { name: "为 TA 换一套衣服" }),
  ).toBeVisible();
  await page
    .locator(".upload-zone input")
    .setInputFiles("assets/demo/lin-yue-card.png");
  await expect(page.locator(".garment-list img")).toHaveCount(1);
  await page.getByRole("button", { name: "生成正面预览 · 查看报价" }).click();
  await expect(page.getByRole("button", { name: "确认并生成" })).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
