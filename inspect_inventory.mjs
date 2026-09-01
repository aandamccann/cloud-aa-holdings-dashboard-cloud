import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/user/Downloads/Cleaned_Vending_Machine_Inventory.xlsx";
const outDir = "C:/Users/user/Documents/Codex/2026-08-25/referenced-chatgpt-conversation-this-is-an/tmp_inventory";
await fs.mkdir(outDir, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
console.log((await workbook.inspect({kind:"sheet",include:"id,name",maxChars:4000})).ndjson);
console.log((await workbook.inspect({kind:"workbook,sheet,table",maxChars:10000,tableMaxRows:15,tableMaxCols:12,tableMaxCellChars:100})).ndjson);
for (const sheet of workbook.worksheets.items) {
  const preview = await workbook.render({sheetName:sheet.name,autoCrop:"all",scale:1,format:"png"});
  await fs.writeFile(`${outDir}/${sheet.name.replace(/[^a-z0-9]+/gi,"_")}.png`,new Uint8Array(await preview.arrayBuffer()));
}
