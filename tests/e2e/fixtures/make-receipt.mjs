/**
 * Renders the receipt fixture used by the receipt-parsing test. Run with
 * `node tests/e2e/fixtures/make-receipt.mjs` after editing; the PNG is
 * committed so the test does not depend on a browser being able to draw it.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "receipt.png");

const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;width:380px;background:#fff;font:13px/1.55 'Courier New',monospace;color:#111;padding:22px">
  <div style="text-align:center">
    <div style="font-size:19px;font-weight:700;letter-spacing:2px">LOBLAWS</div>
    <div>2280 Dundas St W, Toronto ON</div>
    <div>Tel (416) 555-0148</div>
  </div>
  <hr style="border:0;border-top:1px dashed #999;margin:14px 0">
  <div>DATE 09/15/2026&nbsp;&nbsp;&nbsp;14:32</div>
  <div>TERM 04&nbsp;&nbsp;OPER 219</div>
  <hr style="border:0;border-top:1px dashed #999;margin:14px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td>MILK 2% 4L</td><td align="right">6.49</td></tr>
    <tr><td>BANANAS 1.2KG</td><td align="right">2.14</td></tr>
    <tr><td>CHICKEN BREAST</td><td align="right">14.87</td></tr>
    <tr><td>OLIVE OIL 1L</td><td align="right">18.99</td></tr>
    <tr><td>PASTA x3</td><td align="right">7.47</td></tr>
    <tr><td>TOMATOES 900G</td><td align="right">4.29</td></tr>
  </table>
  <hr style="border:0;border-top:1px dashed #999;margin:14px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr><td>SUBTOTAL</td><td align="right">54.25</td></tr>
    <tr><td>HST 13%</td><td align="right">7.05</td></tr>
    <tr style="font-weight:700;font-size:16px">
      <td style="padding-top:8px">TOTAL</td>
      <td align="right" style="padding-top:8px">61.30</td>
    </tr>
    <tr><td style="padding-top:8px">VISA TENDER</td><td align="right" style="padding-top:8px">70.00</td></tr>
    <tr><td>CHANGE</td><td align="right">8.70</td></tr>
  </table>
  <hr style="border:0;border-top:1px dashed #999;margin:14px 0">
  <div style="text-align:center">THANK YOU FOR SHOPPING</div>
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 380, height: 640 } });
await page.setContent(html);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log(`wrote ${OUT}`);
