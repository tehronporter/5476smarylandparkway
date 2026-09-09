import { test, expect } from "@playwright/test";
const stats = (page: any) =>
  page.evaluate(() => (window as any).houseExplorer.stats());
async function ready(page: any) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).houseExplorer);
  await expect(page.locator("#loading")).toBeHidden();
}
test("desktop: actual 3D data, rooms, display controls, picking and plans", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const total = await page.evaluate(
    () => (window as any).houseExplorer.source().objects,
  );
  const ceilingless = (await stats(page)).visibleObjects;
  // The default view hides ceilings, so it shows strictly fewer than everything.
  expect(ceilingless).toBeGreaterThan(1000);
  expect(ceilingless).toBeLessThan(total);
  expect((await stats(page)).triangles).toBeGreaterThan(20000);
  await page.screenshot({ path: "docs/screenshots/desktop.png" });
  await page.locator('[data-layout="ground"]').click();
  const ground = await stats(page);
  expect(ground.visibleObjects).toBeLessThan(ceilingless);
  await page.locator('[data-layout="upper"]').click();
  expect((await stats(page)).layout).toBe("upper");
  await page.locator('[data-layout="assembled"]').click();
  expect((await stats(page)).layout).toBe("assembled");
  await page.locator("#ceilings").check();
  expect((await stats(page)).ceilings).toBe(true);
  expect((await stats(page)).visibleObjects).toBeGreaterThan(ceilingless);
  await page.locator("#cutaway").uncheck();
  expect((await stats(page)).cutaway).toBe(false);
  await page.locator('[data-view="kitchen"]').click();
  // A client interior view shows every exported object.
  expect((await stats(page)).visibleObjects).toBe(total);
  expect((await stats(page)).view).toBe("kitchen");
  await page.screenshot({ path: "docs/screenshots/kitchen.png" });
  const c = await stats(page);
  await page.locator('[data-mode="walk"]').click();
  await page.locator('[data-step="forward"]').click();
  expect((await stats(page)).camera).not.toEqual(c.camera);
  await page.locator('[data-mode="orbit"]').click();
  await page.locator("#reset").click();
  const canvas = page.locator("#viewport canvas");
  await canvas.click({ position: { x: 600, y: 550 } });
  await expect(page.locator("#selection")).toBeVisible();
  await page.locator("#close-selection").click();
  for (const id of [
    "living",
    "powder",
    "garage",
    "stairs",
    "bedroom1",
    "bathroom1",
    "bedroom2",
    "bathroom2",
    "hall",
    "laundry",
    "patio",
  ]) {
    await page.locator(`[data-view="${id}"]`).click();
    expect((await stats(page)).view).toBe(id);
    expect((await stats(page)).visibleObjects).toBeGreaterThan(0);
    await page.screenshot({ path: `docs/screenshots/${id}.png` });
  }
  await page.locator('[data-page="plans"]').click();
  await expect(page.locator("#plan-image")).toBeVisible();
  await page.locator('[data-plan="2"]').click();
  await expect(page.locator("#plan-image")).toHaveAttribute(
    "src",
    "/plans/level-2.png",
  );
  await page.locator("#plan-plus").click();
  await expect(page.locator("#plan-fit")).toHaveText("125%");
  await page.locator("#plan-fit").click();
  await page.screenshot({ path: "docs/screenshots/plans.png" });
  expect(errors).toEqual([]);
});
test("mobile: viewport, room drawer, navigation and floor plans", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "docs/screenshots/mobile.png" });
  await page.locator("#mobile-spaces").click();
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.locator('[data-view="kitchen"]').click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
  await expect(page.locator("#view-title")).toHaveText("Kitchen");
  await page.screenshot({ path: "docs/screenshots/mobile-kitchen.png" });
  await page.locator('[data-page="plans"]').click();
  await expect(page.locator("#plans-panel")).toBeVisible();
  await page.locator('[data-plan="2"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "docs/screenshots/mobile-plans.png" });
});
test("model fetch failure leaves the dimensioned plans usable", async ({
  page,
}) => {
  await page.route("**/model/house.json", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator("#viewer-error")).toBeVisible();
  await page.locator('[data-page="plans"]').click();
  await expect(page.locator("#plan-image")).toBeVisible();
});
test("reviewed hall and laundry viewpoints, auto rotation and PNG capture", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await ready(page);
  for (const id of ["hall", "laundry"]) {
    await page.locator(`[data-view="${id}"]`).click();
    await page.screenshot({ path: `docs/screenshots/${id}.png` });
    expect((await stats(page)).view).toBe(id);
  }
  await page.locator('[data-view="overview"]').click();
  const before = await stats(page);
  await page.locator("#auto").check();
  await expect
    .poll(async () => JSON.stringify((await stats(page)).camera))
    .not.toBe(JSON.stringify(before.camera));
  await page.locator("#auto").uncheck();
  const png = page.waitForEvent("download");
  await page.locator("#capture").click();
  expect((await png).suggestedFilename()).toBe(
    "5476-Maryland-overview-V9.4.png",
  );
  await page.locator("#fullscreen").click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !!document.fullscreenElement ||
            document.querySelector(".stage")!.classList.contains("expanded"),
        ),
      // Headless fullscreen transitions are slow once the suite has been
      // running for a while, so give the state change room.
      { timeout: 20000 },
    )
    .toBe(true);
  await page.locator("#fullscreen").click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !!document.fullscreenElement ||
            document.querySelector(".stage")!.classList.contains("expanded"),
        ),
      { timeout: 20000 },
    )
    .toBe(false);
  expect(errors).toEqual([]);
});
test("floor-plan Fit shows the full sheet and zoom enlarges it", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-page="plans"]').click();
  await page.locator("#plan-image").evaluate(async (img: HTMLImageElement) => {
    await img.decode();
  });
  for (const level of ["1", "2"]) {
    await page.locator(`[data-plan="${level}"]`).click();
    await expect
      .poll(async () => {
        const im = await page.locator("#plan-image").boundingBox();
        const box = await page.locator(".plan-scroll").boundingBox();
        return im!.height <= box!.height && im!.width <= box!.width;
      })
      .toBe(true);
  }
  const before = await page.locator("#plan-image").boundingBox();
  await page.locator("#plan-plus").click();
  expect(
    (await page.locator("#plan-image").boundingBox())!.height,
  ).toBeGreaterThan(before!.height);
  await page.locator("#plan-fit").click();
  await page.screenshot({ path: "docs/screenshots/plans.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const im = await page.locator("#plan-image").boundingBox();
      const box = await page.locator(".plan-scroll").boundingBox();
      return im!.height <= box!.height && im!.width <= box!.width;
    })
    .toBe(true);
  await page.screenshot({ path: "docs/screenshots/mobile-plans.png" });
});
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// Headless throttles requestAnimationFrame, so held-key walking is not
// measurable here. The on-screen pad issues one fixed step per click through
// the same movement path, which makes these checks frame-rate independent.
async function step(page: any, direction: string, times: number) {
  const button = page.locator(`[data-step="${direction}"]`);
  for (let i = 0; i < times; i++) await button.click();
}
test("walk mode encloses the house, stands on a floor and reaches the upper level", async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  await page.locator('[data-mode="walk"]').click();
  const walking = await stats(page);
  // Inspection settings are the opposite of what standing inside needs.
  expect(walking.mode).toBe("walk");
  expect(walking.cutaway).toBe(false);
  expect(walking.ceilings).toBe(true);
  // Side-by-side would park the upper floor 9 m away from the stairs.
  expect(walking.layout).toBe("assembled");
  expect(walking.view).toBe("living");
  // Standing on the ground slab, not floating at inspection height.
  expect(walking.camera[1]).toBeGreaterThan(1.3);
  expect(walking.camera[1]).toBeLessThan(2);
  await expect(page.locator("#walk-pad")).toBeVisible();
  // The switches must show what walk mode actually did, and stop taking input.
  await expect(page.locator("#cutaway")).not.toBeChecked();
  await expect(page.locator("#ceilings")).toBeChecked();
  await expect(page.locator("#cutaway")).toBeDisabled();
  // The rendered switches, not just the properties, have to match the mode.
  await expect(page.locator("#cutaway").locator("..")).not.toHaveClass(
    /\bon\b/,
  );
  await expect(page.locator("#ceilings").locator("..")).toHaveClass(/\bon\b/);
  // The switches cross-fade over 150ms of animation time, which is slow in
  // wall-clock terms while headless throttles this scene. Wait for the paint
  // to actually land so the captured evidence shows the settled state.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          ["cutaway", "ceilings"].map((id) => {
            const input = document.getElementById(id) as HTMLInputElement;
            return getComputedStyle(input.nextElementSibling as HTMLElement)
              .backgroundColor;
          }),
        ),
      { timeout: 30000 },
    )
    .toEqual(["rgb(228, 231, 221)", "rgb(114, 139, 88)"]);
  await page.screenshot({ path: "docs/screenshots/walk-entry.png" });

  // Q/E is the only way up without stair collision. It snaps to a storey, so
  // one press lands on the upper floor and further presses stay put rather
  // than drifting the camera up inside the roof.
  const groundEye = walking.camera[1];
  await step(page, "up", 1);
  const upstairs = (await stats(page)).camera[1];
  expect(upstairs).toBeGreaterThan(groundEye + 2);
  await step(page, "up", 4);
  expect((await stats(page)).camera[1]).toBeCloseTo(upstairs, 5);
  await page.screenshot({ path: "docs/screenshots/walk-upper.png" });
  await step(page, "down", 1);
  expect((await stats(page)).camera[1]).toBeCloseTo(groundEye, 5);

  // Leaving walk hands the display controls back.
  await page.locator('[data-mode="orbit"]').click();
  expect((await stats(page)).mode).toBe("orbit");
  // Walk started at the entry, which is an interior view, so the cutaway stays
  // held; it is handed back on the exterior overview.
  await expect(page.locator("#cutaway")).toBeDisabled();
  await page.locator('[data-view="overview"]').click();
  await expect(page.locator("#cutaway")).toBeEnabled();
});
test("walking stops at walls instead of passing through them", async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  await page.locator('[data-mode="walk"]').click();
  const start = (await stats(page)).camera;
  // Ask for far more travel in one direction than the house is long.
  await step(page, "forward", 60);
  const stopped = (await stats(page)).camera;
  const travelled = flat(start, stopped);
  expect(travelled).toBeGreaterThan(0.3);
  expect(travelled).toBeLessThan(20);
  // Held against a wall, it holds position rather than seeping through.
  await step(page, "forward", 15);
  expect(flat(stopped, (await stats(page)).camera)).toBeLessThan(0.5);
  // A blocked walker is never trapped: reversing always gets them out.
  await step(page, "backward", 8);
  expect(flat(stopped, (await stats(page)).camera)).toBeGreaterThan(0.5);
});
test("camera buttons turn and tilt the view without a pointer", async ({
  page,
}) => {
  await ready(page);
  const start = await stats(page);
  await page.locator("#turn-left").click();
  const turned = await stats(page);
  expect(flat(start.camera, turned.camera)).toBeGreaterThan(0.3);
  await page.locator("#tilt-up").click();
  expect((await stats(page)).camera[1]).not.toBe(turned.camera[1]);
});
test("interior views keep their walls when the cutaway is toggled", async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  await page.locator('[data-view="bathroom2"]').click();
  const inside = await stats(page);
  // Entering an interior view turns the cutaway off and ceilings on.
  expect(inside.cutaway).toBe(false);
  expect(inside.ceilings).toBe(true);
  expect(inside.visibleObjects).toBeGreaterThan(1000);
  // The clip would cut every upstairs wall to 1.10 m while the eye sits at
  // 1.78 m, so the control is held rather than allowed to empty the room.
  await expect(page.locator("#cutaway")).toBeDisabled();
  await expect(page.locator("#cutaway").locator("..")).toHaveClass(
    /\blocked\b/,
  );
  await expect(page.locator("#cutaway").locator("..")).not.toHaveClass(
    /\bon\b/,
  );
  await page.locator("#cutaway").click({ force: true });
  const after = await stats(page);
  expect(after.cutaway).toBe(false);
  expect(after.visibleObjects).toBe(inside.visibleObjects);
  await page.screenshot({ path: "docs/screenshots/bathroom2-walls.png" });
  // Leaving for the exterior overview hands the control back.
  await page.locator('[data-view="overview"]').click();
  await expect(page.locator("#cutaway")).toBeEnabled();
  expect((await stats(page)).cutaway).toBe(true);
});
