# GitHub Actions Workflows

This directory contains CI/CD workflows for ClippyPOE.

## Workflows

### 1. Test & Lint (`test.yml`)
**Trigger**: Push to main/develop, Pull Requests

**Purpose**: Validates code quality and ensures tests pass

**What it does**:
- Runs on Node.js 18.x and 20.x
- Installs dependencies with `npm ci`
- Runs test suite with `npm test`
- Verifies build succeeds

**Duration**: ~2-3 minutes

---

### 2. Release Build (`release.yml`)
**Trigger**: Git tag push (e.g., `v1.0.0`)

**Purpose**: Automates cross-platform builds and GitHub Release creation

**What it does**:
- Builds for Windows, Linux, and macOS in parallel
- Runs full test suite before building
- Creates installers (.exe, .AppImage, .dmg)
- Uploads artifacts to GitHub Release
- Auto-generates release notes from commits

**Duration**: ~10-15 minutes

**How to use**:
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# Wait for workflow to complete
# Release will be available at:
# https://github.com/2019julie-x/PoE-helper-overlay/releases
```

---

### 3. PR Checks (`pr-checks.yml`)
**Trigger**: Pull Request opened/updated

**Purpose**: Validates pull requests before merge

**What it does**:
- Runs test suite
- Checks build succeeds
- Validates package.json version format
- Ensures .opencode/ and node_modules/ aren't tracked
- Comments on PR when checks pass

**Duration**: ~2-3 minutes

---

## Dependabot Configuration

**File**: `dependabot.yml`

**Purpose**: Automated dependency updates

**What it does**:
- Weekly npm dependency updates (Mondays)
- Monthly GitHub Actions updates
- Groups minor/patch updates together
- Auto-assigns to maintainer
- Labels PRs as "dependencies" or "github-actions"

---

## Workflow Status Badges

Add these to README.md to show build status:

```markdown
![Test & Lint](https://github.com/2019julie-x/PoE-helper-overlay/workflows/Test%20&%20Lint/badge.svg)
![Release Build](https://github.com/2019julie-x/PoE-helper-overlay/workflows/Release%20Build/badge.svg)
```

---

## Secrets Required

The workflows use GitHub's built-in `GITHUB_TOKEN` which is automatically provided. No additional secrets configuration needed.

---

## Release Process

### Creating a Release

1. **Ensure main branch is clean**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Update version in package.json**
   ```bash
   npm version patch  # 1.0.0 → 1.0.1
   # or
   npm version minor  # 1.0.0 → 1.1.0
   # or
   npm version major  # 1.0.0 → 2.0.0
   ```

3. **Push the tag**
   ```bash
   git push origin main --tags
   ```

4. **Wait for GitHub Actions**
   - Check: https://github.com/2019julie-x/PoE-helper-overlay/actions
   - Builds take ~10-15 minutes
   - Release auto-created with installers

5. **Verify release**
   - Visit: https://github.com/2019julie-x/PoE-helper-overlay/releases
   - Download and test installers

### Release Notes

Release notes are auto-generated from commit messages since the last tag. Use conventional commits for better notes:

```bash
feat: add new feature
fix: resolve bug
chore: update dependencies
docs: improve documentation
```

---

## Troubleshooting

### Build fails on specific platform
- Check the workflow logs in GitHub Actions
- Common issues:
  - Missing dependencies for platform
  - electron-builder configuration
  - Platform-specific code errors

### Release not created
- Ensure tag format is `v*.*.*` (e.g., `v1.0.0`)
- Check that all platform builds succeeded
- Verify GITHUB_TOKEN permissions

### Tests fail
- Run `npm test` locally to reproduce
- Check Node.js version compatibility
- Review test failure logs in Actions tab

---

## Local Testing

Test workflows locally before pushing:

```bash
# Install act (GitHub Actions local runner)
# https://github.com/nektos/act

# Run test workflow
act push -W .github/workflows/test.yml

# Simulate release (dry run)
act push --dry-run -W .github/workflows/release.yml
```

---

## Maintenance

### Updating Workflows

1. Edit workflow files in `.github/workflows/`
2. Test changes on a branch first
3. Create PR to merge to main
4. Workflows will validate themselves

### Disabling Workflows

Temporarily disable by adding to workflow file:
```yaml
on:
  workflow_dispatch:  # Manual trigger only
```

Or delete/rename the workflow file.
