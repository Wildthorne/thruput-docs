---
title: Package setup
description: Install Project Thruput's public npm packages for TypeScript and React applications.
---

The `@thruputchain` TypeScript client and React library are public packages on [npm](https://www.npmjs.com/org/thruputchain). Install the packages your application imports. No GitHub account or access token is required.

## Before you start

Install Node.js 22.12 or newer and npm.

## Give npm package access

New projects use the public npm registry without additional configuration. If you followed the older GitHub Packages instructions, remove this entry from your project's `.npmrc` and your user-level `~/.npmrc`, wherever it appears:

```ini
@thruputchain:registry=https://npm.pkg.github.com
```

Keep unrelated registry settings and credentials. If an existing lockfile still resolves `@thruputchain` packages through GitHub Packages, update those resolutions before using it for a clean install.

These pages use `@thruputchain/client` 0.25.0 with `@thruputchain/protocol` 0.19.1. Install those versions and keep the generated lockfile.

## Install the TypeScript client

In a new application directory:

```bash
npm init -y
npm pkg set type=module
npm install --save-exact @thruputchain/client@0.25.0 @thruputchain/protocol@0.19.1
npm install --save-dev typescript tsx @types/node
mkdir -p src
```

In an existing application, keep its package configuration and add the dependencies you need. `tsx` runs the Node.js examples; browser apps can use their existing bundler.

The client re-exports common types and constructors. Install the protocol package directly when you import protocol-only constants such as `NATIVE_TOKEN_ADDRESS`. Use the protocol version that the client requires; a different version installs a second copy. Schema tooling can import `@thruputchain/contract-spec`; ordinary generated bindings use the client runtime.

## Type-check an application

For the Node.js examples, create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

```bash
npx tsc
```

The examples use ESM imports and `.js` paths for local TypeScript modules. Browser projects should keep the module settings required by their bundler.
