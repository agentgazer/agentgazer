import React from "react";
import { render } from "ink";
import { Overview } from "../tui/Overview.js";

export async function cmdOverview(port: number = 18880): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { waitUntilExit } = render(React.createElement(Overview, { port }) as any);
  await waitUntilExit();
}
