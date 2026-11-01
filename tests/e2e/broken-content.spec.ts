import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startDevServer } from "./dev-server";

// `npm run play` is the dev server, where the stylesheet arrives by a JavaScript
// module that a content error stops. The production build the other specs use
// has a <link> instead, so this bug cannot be seen there. This spec starts its
// own server, on a port the system chooses, so the other specs do not pay for it.
const root = path.join(import.meta.dirname, "../..");
const brokenUi: unknown = {
  ...(JSON.parse(
    readFileSync(path.join(root, "content/ui.json"), "utf8"),
  ) as object),
  title: "",
};

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  ({ server, origin } = await startDevServer());
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  // The browser gets the broken file, and content/ on disk is never touched.
  await page.route("**/content/ui.json*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export default ${JSON.stringify(brokenUi)};`,
    }),
  );
});

test("a broken data file says what is wrong, in words that can be read", async ({
  page,
}) => {
  await page.goto(`${origin}?seed=1`);

  const message = page.locator("#root pre");
  await expect(message).toBeVisible();
  await expect(message).toContainText("ContentError");
  await expect(message).toContainText("at title");
  await expect(page.locator("canvas")).toHaveCount(0);

  expect(await contrastOf(message)).toBeGreaterThanOrEqual(4.5);
});

test("a data file that is not valid JSON says which and where", async ({
  page,
}) => {
  // The route above fakes what the server sends, but this mistake has to reach
  // the server. So this one reads the file with a key unquoted, and leaves it alone.
  const notJson = await startDevServer({
    cacheDir: "node_modules/.vite-not-json",
    plugins: [
      {
        name: "unquote-a-key",
        enforce: "pre",
        load(id) {
          if (!id.split("?")[0]?.endsWith("/content/ui.json")) return null;
          return readFileSync(
            path.join(root, "content/ui.json"),
            "utf8",
          ).replace('"title"', "title");
        },
      },
    ],
  });
  await page.unroute("**/content/ui.json*");
  try {
    await page.goto(`${notJson.origin}?seed=1`);

    const message = page.locator("#root pre");
    await expect(message).toBeVisible();
    await expect(message).toContainText("content/ui.json");
    await expect(message).toContainText(/line 2/);
    await expect(page.locator("canvas")).toHaveCount(0);

    expect(await contrastOf(message)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await notJson.server.close();
  }
});

type Colour = [red: number, green: number, blue: number, alpha: number];

/** The WCAG contrast of an element's text against what is really behind it. */
async function contrastOf(element: Locator): Promise<number> {
  const { text, behind } = await element.evaluate((start) => {
    const backgrounds: string[] = [];
    for (let at: Element | null = start; at; at = at.parentElement) {
      backgrounds.push(getComputedStyle(at).backgroundColor);
    }
    return { text: getComputedStyle(start).color, behind: backgrounds };
  });

  // A page with no background of its own is white.
  let background: Colour = [255, 255, 255, 1];
  for (const layer of behind.reverse()) {
    background = over(parseColour(layer), background);
  }
  const foreground = over(parseColour(text), background);

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColour(css: string): Colour {
  const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(css);
  if (!match) throw new Error(`Cannot read the colour "${css}".`);
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? 1 : Number(match[4]),
  ];
}

/** Lays a colour over an opaque one. */
function over(top: Colour, under: Colour): Colour {
  const mix = (channel: 0 | 1 | 2) =>
    top[channel] * top[3] + under[channel] * (1 - top[3]);
  return [mix(0), mix(1), mix(2), 1];
}

function luminance([red, green, blue]: Colour): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}
