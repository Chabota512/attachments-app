---
name: GitHub push path
description: Environment-specific guidance for publishing changes from this imported checkout to the connected GitHub repository.
---

Use the authorized GitHub connection for repository writes when shell `git push` reports that no username or token is available. Preserve the live remote branch as the base and apply only the intended file changes; do not force-push the local imported branch over newer GitHub history.

**Why:** The imported checkout and the connected repository can have different commit histories, and the shell does not receive the GitHub integration credential.

**How to apply:** Compare the target files with the live `main` tree, create/update the Git tree and commit through the GitHub connection, then confirm `refs/heads/main` and the target file blobs.