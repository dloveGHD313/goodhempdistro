# scripts/ai_autopush.ps1
# Stages, commits (if needed), and pushes current branch (PowerShell-safe).

$ErrorActionPreference = "Stop"

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree *> $null

# Current branch
$branch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
Write-Host "ERROR: Could not determine current branch."
exit 1
}

# Stage everything
git add -A

# Commit only if there are staged changes
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
# If Cursor didn't provide a message, use a safe default
$msg = $env:AI_COMMIT_MESSAGE
if ([string]::IsNullOrWhiteSpace($msg)) {
$msg = "chore: automated commit"
}
git commit -m $msg
} else {
Write-Host "No changes to commit."
}

# Push and set upstream if needed
git push -u origin $branch
Write-Host "Pushed branch: $branch"