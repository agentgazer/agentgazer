## 1. CLI Setup

- [x] 1.1 Add flags to uninstall command: `--all`, `--config`, `--keys`, `--data`
- [x] 1.2 Create interactive menu using readline (5 options)
- [x] 1.3 Create confirmation prompt helper function

## 2. Cleanup Functions

- [x] 2.1 Implement `stopDaemonIfRunning()` - read PID file, kill process
- [x] 2.2 Implement `removeProviderKeys()` - list and delete from secret store
- [x] 2.3 Implement `removeConfig()` - delete config.json
- [x] 2.4 Implement `removeAgentData()` - delete data.db
- [x] 2.5 Implement `removeLogFiles()` - delete log and pid files

## 3. Menu Options

- [x] 3.1 Option 1: Complete uninstall - call all cleanup functions, show binary command
- [x] 3.2 Option 2: Binary only - show npm/brew commands
- [x] 3.3 Option 3: Config only - confirm then removeConfig()
- [x] 3.4 Option 4: Keys only - confirm then removeProviderKeys()
- [x] 3.5 Option 5: Data only - confirm then removeAgentData()

## 4. Flag Handling

- [x] 4.1 `--all` flag triggers complete uninstall (with confirmation)
- [x] 4.2 `--config` flag triggers config removal
- [x] 4.3 `--keys` flag triggers keys removal
- [x] 4.4 `--data` flag triggers data removal

## 5. Testing

- [x] 5.1 Test interactive menu display
- [x] 5.2 Test each cleanup function independently
- [x] 5.3 Test complete uninstall flow
