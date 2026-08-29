---
title: "Sandboxing Agentic AI With Disposable VMs"
date: "2026-08-20"
tags: ["security", "qemu", "agents"]
excerpt: "Why I gave every agent run its own throwaway QEMU sandbox instead of trusting a container boundary."
---

Giving a language model shell access is easy. Giving it shell access you're
comfortable walking away from is the hard part.

## The problem with containers

Namespaces and cgroups are process isolation, not security boundaries against
a kernel exploit. For anything that executes model-generated code, a shared
kernel is a shared blast radius.

## What changed

Each agent run now gets a disposable QEMU microVM, torn down when the task
ends. The overhead is a couple hundred milliseconds of boot time — cheap,
compared to the alternative.

```python
with MachineBox.spawn(image="agent-base") as vm:
    result = vm.run(command)
```

That's roughly the whole API surface. Snapshotting and pooling warm VMs is
what makes the boot cost disappear in practice.
