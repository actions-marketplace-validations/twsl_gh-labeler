# GitHub Copilot Instructions for gh-labeler

## Project Overview

This is a GitHub Action built with TypeScript that automatically labels issues, pull requests, and discussions based on regular expression patterns and content rules. The action provides powerful configuration-driven automation for managing GitHub repository workflows.

## Tech Stack

- **Language**: TypeScript (ECMAScript 2022 target)
- **Package Manager**: pnpm
- **Linter/Formatter**: Biome
- **Testing**: Jest with ts-jest
- **Bundler**: Rollup
- **Runtime**: Node.js >= 20

## Project Structure

```text
src/
  ├── handlers/          # Event handlers for issues, PRs, discussions, and regular expression scanning
  ├── models/            # Data models and configuration types
  ├── schemas/           # Validation schemas (likely Joi/Zod)
  ├── types/             # TypeScript type definitions
  └── validators/        # Custom validation logic
tests/                   # Jest test files
data/                    # Test fixtures and sample payloads
```

## Development Commands

- `pnpm run format` - Format code with Biome
- `pnpm run lint` - Lint and autofix with Biome
- `pnpm test` - Run Jest tests
- `pnpm run package` - Bundle with Rollup
- `pnpm run package:watch` - Watch mode for bundling
- `pnpm run all` - Run format, lint, test, coverage, and package

## Code Style & Conventions

### TypeScript Configuration

- **Strict Mode**: Enabled (`strict: true`)
- **Target**: ECMAScript 2022
- **Module System**: ESNext with ES modules
- **Path Aliases**: Use `@/*` for `src/*` imports
- **Null Checks**: Strict null checks enabled
- **Index Access**: No unchecked indexed access (`noUncheckedIndexedAccess: true`)
- **Unused Locals**: Not allowed (`noUnusedLocals: true`)

### Formatting & Linting

- **Tool**: Biome (not Prettier/ESLint)
- **Config**: See `biome.json` - `noExplicitAny` is disabled
- **Autofix**: Use `pnpm run lint` or `pnpm run format` before committing

### Naming Conventions

- **Classes**: PascalCase (e.g., `IssueHandler`, `PullRequestHandler`)
- **Files**: camelCase for TypeScript files (e.g., `issueHandler.ts`)
- **Interfaces/Types**: PascalCase, use `type` for unions/primitives
- **Models**: Import with `type` keyword (e.g., `import type Config from "@/models/config"`)

## Testing Guidelines

### Test Structure

- **Framework**: Jest with ES modules support
- **Location**: All test files in `tests/` directory
- **Naming**: `*.test.ts` pattern
- **Fixtures**: Store test data in `tests/fixtures/`
- **Coverage**: Coverage reports generated in `coverage/`

### Testing Patterns

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock external dependencies
jest.mock("@actions/core");
jest.mock("@actions/github");

describe("HandlerName", () => {
  let handler: HandlerName;
  let mockConfig: Config;
  let mockActionConfig: GHActionConfig;

  beforeEach(() => {
    // Setup mocks
    mockConfig = {
      /* ... */
    } as Config;
    mockActionConfig = {
      /* ... */
    };
    handler = new HandlerName(mockConfig, mockActionConfig);
  });

  it("should describe expected behavior", async () => {
    // Test implementation
  });
});
```

### Test Coverage

- Run tests: `pnpm test`
- Tests should cover handlers, validation logic, and configuration processing
- Use spies for verifying GitHub API calls
- Mock `@actions/core` and `@actions/github` in tests

## GitHub Actions Specific

### Handler Pattern

Each handler extends `BaseHandler` and implements:

- Event-specific processing logic
- Label management
- Comment posting
- GitHub API interactions via Octokit

### Configuration

- **Config Path**: `.github/gh-labeler.yaml` (default)
- **Schema Validation**: Validate configs using schemas in `src/schemas/`
- **Type Safety**: Use `Config` and `GHActionConfig` types

### Event Types

Handle these GitHub webhook events:

- Issues (`IssuesEvent` from `@octokit/webhooks-types`)
- Pull Requests (`PullRequestEvent`)
- Discussions (`DiscussionEvent`)

## Dependencies & Imports

### Key Packages

- `@actions/core` - GitHub Actions logging and utilities
- `@actions/github` - GitHub API client (Octokit)
- `@octokit/webhooks-types` - GitHub webhook event types
- `yaml` - YAML parsing for config files
- `joi` - Likely used for schema validation

### Import Guidelines

- **Absolute Imports**: ALWAYS use `@/` alias for all src imports - never use relative imports like `./` or `../`

  ```typescript
  import { IssueHandler } from "@/handlers/issueHandler";
  import type Config from "@/models/internal/config";
  import type { Issue } from "@/models/github";

  // ❌ NEVER do this
  import { IssueHandler } from "./handlers/issueHandler";
  import Config from "../models/config";
  ```

- **Type Imports**: Prefer `import type` for type-only imports
- **Node Built-ins**: Use `node:` prefix (e.g., `import * as fs from "node:fs"`)

## Build & Bundling

### Rollup Configuration

- Entry: `src/main.ts`
- Output: `dist/index.js`
- Uses `@rollup/plugin-typescript`
- Action runs with: `using: node20` in `action.yml`

### Production Bundle

- Always run `pnpm run package` before committing
- Bundled output must be committed to `dist/`
- Verify bundle with `check-dist` workflow

## Error Handling

### GitHub Actions Context

```typescript
try {
  // Action logic
} catch (e: unknown) {
  core.setFailed(`Error message: ${e}`);
  throw e;
}
```

### Validation

- Validate action inputs using schemas
- Validate configuration files before processing
- Fail gracefully with helpful error messages

## File System Operations

- Check file existence with `fs.existsSync()`
- Read files with `fs.readFileSync()` using `utf8` encoding
- Parse YAML configs with `parse()` from `yaml` package

## Best Practices

1. **Type Safety**: Leverage TypeScript strict mode features
2. **Async/Await**: Use async/await for all async operations
3. **Error Messages**: Provide clear, actionable error messages
4. **Testing**: Write tests for new handlers and validation logic
5. **Documentation**: Update readme for configuration changes
6. **Immutability**: Prefer const and readonly where applicable
7. **ESM**: Use ES modules syntax throughout
8. **No Any**: Minimize use of `any` type (already disabled in Biome)

## Performance Considerations

- Bundle size matters for GitHub Actions startup time
- Use lazy loading where appropriate
- Avoid unnecessary API calls to GitHub
- Cache repeated computations

## Security

- Never log sensitive tokens or credentials
- Use `github-token` input for authentication
- Validate all external input (configs, webhook payloads)
- Be cautious with regular expression patterns (avoid ReDoS)

## Common Patterns

### Handler Initialization

```typescript
const handler = new IssueHandler(config, actionConfig);
await handler.handle(eventPayload);
```

### Regular Expression Matching

- Support case-insensitive matching by default
- Use word boundaries (`\b`) for precise matching
- Store patterns in config as strings, compile as needed

### Label Management

```typescript
await client.rest.issues.addLabels({
  owner,
  repo,
  issue_number,
  labels: ["label1", "label2"],
});
```

## Debugging

- Use `core.debug()` for verbose logging
- Use `core.info()` for standard logging
- Use `core.warning()` for non-fatal issues
- Use `core.setFailed()` for action failures

## Version Requirements

- Node.js >= 20 (specified in package.json engines)
- TypeScript configuration targets ECMAScript 2022
- GitHub Actions runtime: node20
