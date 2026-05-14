#!/usr/bin/env bun

import { render } from "ink";
import React from "react";
import { Dashboard } from "./dashboard";

// Parse command line arguments
const args = process.argv.slice(2);
const serverUrl =
  args[0] || process.env.TASKFORGE_URL || "http://localhost:3001";

console.clear();

console.log(`
╔══════════════════════════════════════╗
║       ⚡ job-queue-system CLI Dashboard      ║
║       Connecting to ${serverUrl}... ║
╚══════════════════════════════════════╝
`);

// Render the Ink dashboard
const { unmount } = render(React.createElement(Dashboard, { serverUrl }));

// Handle exit
process.on("SIGINT", () => {
  unmount();
  process.exit(0);
});
