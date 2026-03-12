import pc from "picocolors";

export const logger = {
  break: () => console.log(""),
  error: (msg: string) => console.log(pc.red(`  ✗ ${msg}`)),
  info: (msg: string) => console.log(pc.cyan(msg)),
  success: (msg: string) => console.log(pc.green(`  ✓ ${msg}`)),
  warn: (msg: string) => console.log(pc.yellow(`  ⚠ ${msg}`)),
};
