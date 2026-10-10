---
title: Generate TypeScript bindings
description: Generate typed application bindings from a built contract's canonical specification.
---

Generate bindings from the same contract build you deploy. Bindings provide method descriptors, argument types, result decoders, and declared event and error types.

## Generate during a build

```bash
thruput build --bindings ts
```

The build prints the generated binding path alongside the contract artifacts. Use `-p PACKAGE` when selecting a workspace member.

## Write bindings into an application

Build first, then select the binary spec sidecar:

```bash
thruput build
mkdir -p web/src/contracts
thruput codegen ts target/thruput/my_counter.spec.xdr \
  --output web/src/contracts/my-counter.ts
```

Replace `my_counter` with your artifact's name and the output directory with your application's location. `codegen ts` accepts `.spec.xdr`, not the readable `.spec.json` or the deployable `.rv32a` file.

## Keep code and deployment aligned

Regenerate bindings when the contract interface changes. Use the address from the matching deployment rather than an address copied from another example.

Do not edit generated files. Put application wrappers next to them so regeneration does not overwrite application logic.

Continue with [Use contract bindings](/tools/typescript-bindings/) for descriptors and typed calls, or [Read events](/typescript/events/) for filters and decoding.
