import { writeFileSync } from "fs";
import { randomBytes } from "crypto";

const buildId = randomBytes(8).toString("hex");

// Write version.json to public/ so it's served as a static file
writeFileSync("public/version.json", JSON.stringify({ buildId }));

// Print for use as env var
console.log(buildId);
