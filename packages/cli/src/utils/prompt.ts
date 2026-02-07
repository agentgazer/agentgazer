import inquirer from "inquirer";

export async function confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

export async function selectProvider(providers: string[]): Promise<string> {
  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Select provider:",
      choices: providers,
    },
  ]);
  return provider;
}

export async function inputApiKey(provider: string): Promise<string> {
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: `API key for ${provider}:`,
      mask: "*",
    },
  ]);
  return apiKey;
}
