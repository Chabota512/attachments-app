---
name: Dependency firewall
description: Replit package firewall behavior encountered while installing the cloned workspace
---

When a repository lockfile references a package archive rejected by the Replit package firewall, a clean install from the package manifests can resolve allowed versions even when a frozen lockfile install cannot.

**Why:** The repository's locked transitive versions were rejected, while manifest-based resolution installed the workspace successfully without changing application source.

**How to apply:** Preserve the repository lockfile before environment-only installation work and restore it afterward when exact source preservation is required.