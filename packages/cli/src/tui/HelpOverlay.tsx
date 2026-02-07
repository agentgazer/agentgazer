import React from "react";
import { Box, Text, useInput } from "ink";

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps): React.ReactElement {
  useInput((input, key) => {
    if (input === "?" || key.escape || input === "q" || input === "Q") {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Keyboard Shortcuts</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text bold>Q</Text> or <Text bold>ESC</Text> — Exit overview
        </Text>
        <Text>
          <Text bold>R</Text> — Force refresh
        </Text>
        <Text>
          <Text bold>A</Text> — Toggle showing only active agents
        </Text>
        <Text>
          <Text bold>?</Text> — Show/hide this help
        </Text>
      </Box>
      <Box marginTop={2}>
        <Text dimColor>Press ? or ESC to close this help</Text>
      </Box>
    </Box>
  );
}
