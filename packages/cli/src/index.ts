#!/usr/bin/env bun

import { render } from "ink";
import React from "react";
import { Dashboard } from "./dashboard";

// Parse command line arguments
const args = process.argv.slice(2);
const serverUrl =
  args[0] || process.env.JETQUEUE_URL || "http://localhost:3001";

console.clear();

console.log(`
╔══════════════════════════════════════╗
║       ⚡ JetQueue CLI Dashboard      ║
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
