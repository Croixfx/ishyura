const fs = require("fs");
const path = require("path");

const wranglerBinPath = path.join(__dirname, "../node_modules/wrangler/bin/wrangler.js");

if (!fs.existsSync(wranglerBinPath)) {
  // wrangler might not be installed yet or in a different location
  process.exit(0);
}

try {
  let content = fs.readFileSync(wranglerBinPath, "utf8");

  if (content.includes("[ishyura] Ensuring 100% traffic allocation")) {
    // Already patched
    process.exit(0);
  }

  const target = `.on("exit", (code) =>
\t\t\tprocess.exit(code === undefined || code === null ? 0 : code)
\t\t)`;

  const altTarget = `.on("exit", (code) =>\r\n\t\t\tprocess.exit(code === undefined || code === null ? 0 : code)\r\n\t\t)`;

  const replacement = `.on("exit", (code) => {
\t\t\tconst exitCode = code === undefined || code === null ? 0 : code;
\t\t\tconst args = process.argv.slice(2);
\t\t\tif (exitCode === 0 && args[0] === "deploy" && !args.includes("--dry-run")) {
\t\t\t\ttry {
\t\t\t\t\tconsole.log("\\n[ishyura] Ensuring 100% traffic allocation to latest uploaded version...");
\t\t\t\t\tconst { execFileSync } = require("child_process");
\t\t\t\t\tconst cliPath = path.join(__dirname, "../wrangler-dist/cli.js");
\t\t\t\t\tconst listOutput = execFileSync(process.execPath, [cliPath, "versions", "list", "--json"], { encoding: "utf8" });
\t\t\t\t\tconst versions = JSON.parse(listOutput);
\t\t\t\t\tif (versions && versions.length > 0 && versions[0].id) {
\t\t\t\t\t\tconst latestId = versions[0].id;
\t\t\t\t\t\tconsole.log(\`[ishyura] Promoting version \${latestId} to 100% traffic...\`);
\t\t\t\t\t\texecFileSync(process.execPath, [cliPath, "versions", "deploy", \`\${latestId}@100%\`, "--yes"], { stdio: "inherit" });
\t\t\t\t\t\tconsole.log(\`[ishyura] Version \${latestId} successfully promoted to 100% traffic!\\n\`);
\t\t\t\t\t}
\t\t\t\t} catch (err) {
\t\t\t\t\tconsole.warn("[ishyura] Automatic version promotion notice:", err.message || err);
\t\t\t\t}
\t\t\t}
\t\t\tprocess.exit(exitCode);
\t\t})`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(wranglerBinPath, content, "utf8");
    console.log("[ishyura] Successfully patched wrangler for automated version traffic promotion.");
  } else if (content.includes(altTarget)) {
    content = content.replace(altTarget, replacement);
    fs.writeFileSync(wranglerBinPath, content, "utf8");
    console.log("[ishyura] Successfully patched wrangler for automated version traffic promotion.");
  } else {
    console.warn("[ishyura] Target string not found in wrangler.js; skipping patch.");
  }
} catch (e) {
  console.warn("[ishyura] Could not patch wrangler.js:", e.message);
}
