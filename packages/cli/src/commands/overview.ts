import React from "react";
import { render } from "ink";
import { Overview } from "../tui/Overview.js";

export async function cmdOverview(port: number = 8080): Promise<void> {
  const { waitUntilExit } = render(React.createElement(Overview, { port }));
  await waitUntilExit();
}
