---
title: Generate client bindings
description: Deliver a contract's typed interface to TypeScript application developers.
---

Client bindings let an application use your contract's methods, types, errors, and events. Generate them from the contract spec produced by the same build you deploy:

```bash
thruput build --bindings ts
```

The spec describes the exported interface. Bindings turn that description into TypeScript code for application developers.

## Keep the interface and deployment together

- Regenerate bindings when methods, argument or return types, errors, or events change.
- Give application developers the bindings and the matching deployment address and network.
- Keep generated files separate from application code so regeneration does not overwrite manual changes.

See [Generate TypeScript bindings](/cli/codegen/) for output paths and generation from an existing spec, and [Use contract bindings](/tools/typescript-bindings/) for consuming the generated interface in an application.
