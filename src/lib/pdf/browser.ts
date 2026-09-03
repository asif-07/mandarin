import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Launches Chromium. Locally, set PUPPETEER_EXECUTABLE_PATH to an installed
 * Chrome/Chromium. On Vercel (or any Lambda-like runtime) @sparticuz/chromium
 * provides the binary.
 */
export async function launchBrowser(): Promise<Browser> {
  const local = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    });
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: [...chromium.args, "--font-render-hinting=none"],
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

/** Render a self-contained HTML document to an A4 PDF with zero margins. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 });
    // Embedded fonts (and the optional Google CJK fallback) must be ready before printing.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
