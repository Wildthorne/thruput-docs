---
title: Package setup
description: Configure access to Project Thruput's JavaScript packages for TypeScript and React applications.
---

The private `@thruputchain` TypeScript client and React library are distributed through GitHub Packages. Configure registry access once, then install the packages your application imports.

## Before you start

- Install Node.js 22.12 or newer and npm.
- Obtain access to Project Thruput's GitHub packages.
- Install the [GitHub CLI](https://cli.github.com/) and sign in with `gh auth login`.

## Give npm package access

Authorize package reads, then make the token available to npm in this terminal:

```bash
gh auth refresh -h github.com -s read:packages
export NODE_AUTH_TOKEN="$(gh auth token)"
```

Create a `.npmrc` file in the application directory:

```ini
@thruputchain:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Keep `${NODE_AUTH_TOKEN}` as a literal reference in this file. Do not replace it with the token. If your environment already supplies a package-read token, use that instead of the GitHub CLI commands.

These pages use `@thruputchain/client` 0.25.0 with `@thruputchain/protocol` 0.19.1. Install those versions and keep the generated lockfile. A package-access error needs an account or token with the required permissions; repository access alone may not be enough.

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
