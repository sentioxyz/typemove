# CLAUDE.md - TypeMove

This file provides guidance to Claude Code when working with the TypeMove codebase.

## Repository Overview

**TypeMove** is a TypeScript code generation library that creates type-safe bindings for Move smart contracts. It enables developers to interact with Move-based blockchains (Aptos, Sui, Iota) using strongly-typed TypeScript interfaces.

**Repository**: https://github.com/sentioxyz/typemove

## Key Features

- **Type Generation**: Automatically generate TypeScript types from Move smart contract ABIs
- **Type Safety**: Use `bigint` instead of `string` for better type safety
- **Encoding/Decoding**: Type-safe encoding and decoding of Move data structures
- **View Functions**: Simple and type-safe view function calling
- **Transaction Building**: Build transactions with full type safety
- **Module Dependencies**: Automatically manage dependent Move modules
- **Multi-Chain Support**: Aptos, Sui, Iota, and other Move-based chains

## Repository Structure

```
typemove/
├── packages/
│   ├── move/         # Core Move type definitions and utilities
│   ├── aptos/        # Aptos-specific bindings and utilities
│   ├── sui/          # Sui-specific bindings and utilities
│   └── iota/         # Iota-specific bindings and utilities
├── examples/         # Example usage and demonstrations
├── scripts/          # Build and development scripts
└── images/           # Assets and documentation images
```

### Package Structure

**`packages/move/`** - Core package
- Base Move type system
- Common utilities for Move data structures
- Shared encoding/decoding logic

**`packages/aptos/`** - Aptos integration
- Aptos-specific type generation
- View function calling for Aptos
- Transaction building for Aptos
- Resource and object utilities

**`packages/sui/`** - Sui integration
- Sui-specific type generation
- View function calling for Sui
- Transaction building for Sui
- Object and dynamic field utilities

**`packages/iota/`** - Iota integration
- Iota-specific type generation (based on Sui)
- View function calling for Iota
- Transaction building for Iota

## Tech Stack

- **Language**: TypeScript
- **Build System**: pnpm workspaces
- **Package Manager**: pnpm
- **Testing**: Standard TypeScript testing frameworks
- **Linting**: ESLint with custom configuration
- **Formatting**: Prettier

## Development Workflow

### Initial Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build:all
```

### Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build:all

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Build specific package
pnpm --filter @typemove/aptos build
pnpm --filter @typemove/sui build
pnpm --filter @typemove/iota build
```

### Working with Examples

```bash
# Navigate to examples directory
cd examples/

# Run example (varies by example)
pnpm install
pnpm build
```

## Integration with sentio-sdk

TypeMove is a dependency of sentio-sdk for Move-based blockchain support:

- **sentio-sdk** uses TypeMove to generate type-safe bindings for Move smart contracts
- When working on Move chain support in sentio-sdk, you may need to modify TypeMove
- Changes to TypeMove should be tested with sentio-sdk integration

### Testing Integration

1. Make changes in `typemove/`
2. Build TypeMove: `pnpm build:all`
3. Link to sentio-sdk (if testing locally):
   ```bash
   cd typemove/packages/aptos  # or sui/iota
   pnpm link

   cd ../../../sentio-sdk
   pnpm link @typemove/aptos  # or @typemove/sui, @typemove/iota
   ```
4. Test in sentio-sdk with Move chain examples

## Pull Request Workflow

**IMPORTANT: Always use pull requests for changes to TypeMove**

### Creating a Development Branch

TypeMove uses custom git shortcuts (if configured in `.github/.gitconfig`):

```bash
# Create a dev branch
git dev <your-name>/<feature-name>

# Or use standard git
git checkout -b dev/<your-name>/<feature-name>
```

### Making Changes

1. Create a feature branch
2. Make your changes
3. Test thoroughly (all chains: Aptos, Sui, Iota)
4. Run linting and formatting
5. Commit with clear messages
6. Push and create a pull request

### Before Creating a PR

```bash
# Ensure all packages build
pnpm build:all

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### PR Requirements

- All tests must pass
- Code must be linted and formatted
- Changes should not break existing functionality
- Update documentation if adding new features
- Test with all supported chains if applicable

## Common Development Tasks

### Adding Support for a New Chain

1. Create a new package in `packages/<chain-name>/`
2. Follow the structure of existing packages (aptos, sui, iota)
3. Implement chain-specific type generation
4. Add view function and transaction building utilities
5. Create examples in `examples/<chain-name>/`
6. Update main README.md with new chain support

### Improving Type Generation

1. Modify the core type generation logic in `packages/move/`
2. Update chain-specific generators in `packages/<chain>/`
3. Test with various Move contracts
4. Verify backward compatibility

### Adding New Utilities

1. Identify if the utility is chain-specific or universal
2. Add to appropriate package (`move` for universal, `aptos`/`sui`/`iota` for specific)
3. Write tests for the new utility
4. Document usage in package README

## Testing Strategy

- **Unit Tests**: Test individual functions and utilities
- **Integration Tests**: Test with real Move contracts
- **Cross-Chain Tests**: Ensure changes work across all supported chains
- **sentio-sdk Integration**: Verify compatibility with sentio-sdk

## Publishing

TypeMove packages are published to npm:
- `@typemove/move`
- `@typemove/aptos`
- `@typemove/sui`
- `@typemove/iota`

Publishing is typically handled by maintainers after PR approval.

## Support and Resources

- **GitHub Issues**: https://github.com/sentioxyz/typemove/issues
- **npm Packages**: https://www.npmjs.com/org/typemove
- **Sentio Platform**: https://sentio.xyz

## Notes

- TypeMove is a standalone library but primarily developed for sentio-sdk
- When making breaking changes, coordinate with sentio-sdk team
- Maintain backward compatibility when possible
- Document all public APIs thoroughly
