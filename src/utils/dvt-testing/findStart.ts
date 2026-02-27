import * as fs from "fs";
import { parseOriginalTranscript } from "./originalTranscriptParser.js";

const txt = fs.readFileSync("KL.txt", "utf-8");
const parsed = parseOriginalTranscript(txt);
let count = 0;
for (let i = 0; i < parsed.length; i++) {
  const l = parsed[i];
  if (!l.isContinuation) {
    count++;
  }
  if (l.text.includes("10:04:06")) {
    console.log(
      "Logical START_LINE should be:",
      count,
      "for text:",
      l.text.substring(0, 50),
    );
    break;
  }
}
