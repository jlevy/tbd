#!/bin/bash
# Automated GitHub CLI setup for agent sessions
# This script runs on SessionStart to ensure gh CLI is available and authenticated
#
# Supply-chain policy (see SUPPLY-CHAIN-SECURITY.md): the gh version is PINNED to
# a release at least 14 days old, and every download is verified against a pinned
# SHA-256 checksum. Do NOT change this to fetch "latest" from the API at runtime;
# that bypasses the cool-off window. To bump the pin, pick a release that is >=14
# days old and copy its checksums from:
#   https://github.com/cli/cli/releases/download/v<VERSION>/gh_<VERSION>_checksums.txt
#
# Presence is NOT sufficient: an already-installed gh is accepted only if it meets
# GH_MIN_VERSION. A distro-packaged gh is routinely several minor versions behind,
# which is exactly the case the pin exists to fix.

set -euo pipefail

INSTALL_TMP_DIR=""
INSTALL_STAGING=""

cleanup() {
    if [ -n "$INSTALL_STAGING" ]; then
        rm -f -- "$INSTALL_STAGING"
    fi
    if [ -n "$INSTALL_TMP_DIR" ]; then
        rm -rf -- "$INSTALL_TMP_DIR"
    fi
}

# Add common binary locations to PATH
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

# Stacked-PR tooling is opt-in. SessionStart runs this script with no arguments, so the
# default path stays exactly as fast and quiet as before for users who never stack.
WITH_STACK=0
for arg in "$@"; do
    case "$arg" in
        --with-stack) WITH_STACK=1 ;;
        -h|--help)
            echo "Usage: ensure-gh-cli.sh [--with-stack]"
            echo "  --with-stack  Also install the pinned gh-stack extension and its agent skill"
            exit 0
            ;;
        *) echo "[gh] WARNING: ignoring unknown argument: $arg" ;;
    esac
done

# Pinned gh release (>=14 days old per supply-chain cool-off) and its checksums.
GH_VERSION="2.97.0"

# Minimum acceptable gh version; an older gh is replaced with the pinned build.
# The floor tracks the pin because v2.97.0 fixed four advisories, two on paths agents
# use constantly: `gh auth status` printed part of the token in plaintext for ghs_*,
# github_pat_* and ghu_* formats (GHSA-cg6r-mpgc-h9mm), and `gh api` / `gh pr diff`
# emitted externally controlled content without neutralizing terminal escape
# sequences (GHSA-3m3g-3wcr-px46). It also carries the mature `gh skill` commands.
GH_MIN_VERSION="2.97.0"

# GitHub hosts to exempt from a session HTTPS proxy when that proxy intercepts
# GitHub (proxied remote sessions, e.g. Claude Code cloud). Scoped and additive:
# HTTPS_PROXY stays set for all other traffic. release-assets.githubusercontent.com
# is the current release-binary host; objects.githubusercontent.com is its
# predecessor and kept for compatibility.
GITHUB_DIRECT_HOSTS="api.github.com,github.com,release-assets.githubusercontent.com,objects.githubusercontent.com,codeload.github.com,raw.githubusercontent.com,uploads.github.com"

github_no_proxy() {
    echo "${GITHUB_DIRECT_HOSTS}${NO_PROXY:+,$NO_PROXY}"
}

# Direct-egress probes can hang when the network policy blocks direct
# connections; bound them where timeout(1) exists (absent on stock macOS).
run_bounded() {
    if command -v timeout &> /dev/null; then
        timeout 20 "$@"
    else
        "$@"
    fi
}

# SHA-256 checksums from gh_2.97.0_checksums.txt, keyed by asset suffix.
checksum_for() {
    case "$1" in
        linux_amd64.tar.gz) echo "a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112" ;;
        linux_arm64.tar.gz) echo "73ea440ecad9c9e284429997ee6f93577bc6f7bc6fba357ef62c53ad8fb641a5" ;;
        macOS_amd64.zip)    echo "63298c998cc2a924c9e254c6af6a1caad6ece281122687a91f079bc0a462700e" ;;
        macOS_arm64.zip)    echo "a58b8fd77b417a38f47a0b54d1370c59b0fcdb324ccc9ca002b0998f7c4c999e" ;;
        *) echo "" ;;
    esac
}

# Compare dotted versions without sort -V (absent on stock macOS) or python.
# Returns 0 when $1 >= $2. Any prerelease suffix is stripped before comparing, so
# 2.97.0-rc1 compares equal to 2.97.0; gh ships no prereleases through this path.
version_ge() {
    local have="$1" want="$2" i have_part want_part
    local -a have_parts want_parts
    IFS='.' read -r -a have_parts <<< "${have%%-*}"
    IFS='.' read -r -a want_parts <<< "${want%%-*}"
    for i in 0 1 2; do
        have_part=$(printf '%s' "${have_parts[i]:-0}" | tr -cd '0-9')
        want_part=$(printf '%s' "${want_parts[i]:-0}" | tr -cd '0-9')
        have_part=${have_part:-0}
        want_part=${want_part:-0}
        if [ "$((10#$have_part))" -gt "$((10#$want_part))" ]; then return 0; fi
        if [ "$((10#$have_part))" -lt "$((10#$want_part))" ]; then return 1; fi
    done
    return 0
}

# `gh --version` prints "gh version 2.97.0 (2026-07-31)" on its first line.
installed_gh_version() {
    "$1" --version 2>/dev/null | awk 'NR==1 {print $3}'
}

# Decide whether to install. Presence alone is not enough: a distro-packaged gh is
# routinely several minor versions behind, and accepting it silently is how the pin
# fails to apply on exactly the machines that need it.
NEED_INSTALL=0
if command -v gh &> /dev/null; then
    GH_PATH="$(command -v gh)"
    GH_CURRENT="$(installed_gh_version "$GH_PATH")"
    if [ -z "$GH_CURRENT" ]; then
        echo "[gh] CLI at ${GH_PATH} does not report a usable version; installing pinned v${GH_VERSION}"
        NEED_INSTALL=1
    elif version_ge "$GH_CURRENT" "$GH_MIN_VERSION"; then
        # Newer than the pin is fine and is left alone; this must never downgrade.
        echo "[gh] CLI found at ${GH_PATH} (v${GH_CURRENT})"
    else
        echo "[gh] CLI at ${GH_PATH} is v${GH_CURRENT}, below the required v${GH_MIN_VERSION}"
        echo "[gh] Installing pinned v${GH_VERSION} to ~/.local/bin (existing gh left in place)"
        NEED_INSTALL=1
    fi
else
    echo "[gh] CLI not found, installing pinned v${GH_VERSION}..."
    NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" = "1" ]; then

    INSTALL_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tbd-gh.XXXXXX")
    trap cleanup EXIT

    # Detect platform
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    [ "$ARCH" = "x86_64" ] && ARCH="amd64"
    [ "$ARCH" = "aarch64" ] && ARCH="arm64"

    # Build the asset suffix and archive type per platform.
    if [ "$OS" = "darwin" ]; then
        PLATFORM="macOS_${ARCH}.zip"
        ARCHIVE_EXT="zip"
        EXTRACT_DIR="${INSTALL_TMP_DIR}/gh_${GH_VERSION}_macOS_${ARCH}"
    else
        PLATFORM="${OS}_${ARCH}.tar.gz"
        ARCHIVE_EXT="tar.gz"
        EXTRACT_DIR="${INSTALL_TMP_DIR}/gh_${GH_VERSION}_${OS}_${ARCH}"
    fi

    echo "[gh] Detected platform: ${PLATFORM}"

    EXPECTED=$(checksum_for "$PLATFORM")
    if [ -z "$EXPECTED" ]; then
        echo "[gh] ERROR: no pinned checksum for platform ${PLATFORM}; refusing to install"
        echo "[gh] Add the checksum from gh_${GH_VERSION}_checksums.txt to this script"
        exit 1
    fi

    ASSET="gh_${GH_VERSION}_${PLATFORM}"
    ARCHIVE_PATH="${INSTALL_TMP_DIR}/${ASSET}"
    DOWNLOAD_URL="https://github.com/cli/cli/releases/download/v${GH_VERSION}/${ASSET}"

    echo "[gh] Downloading from ${DOWNLOAD_URL}..."
    if ! curl -fsSL -o "$ARCHIVE_PATH" "$DOWNLOAD_URL"; then
        # Proxied remote sessions can intercept GitHub downloads with a proxy 403.
        # Retry once bypassing the proxy for GitHub hosts only; this succeeds when
        # the environment's egress policy allows direct GitHub connections.
        echo "[gh] Download failed (a session proxy may intercept GitHub); retrying with NO_PROXY for GitHub hosts..."
        NP="$(github_no_proxy)"
        NO_PROXY="$NP" no_proxy="$NP" curl -fsSL --connect-timeout 15 -o "$ARCHIVE_PATH" "$DOWNLOAD_URL"
    fi

    # Verify the download against the pinned checksum before extracting.
    if command -v sha256sum &> /dev/null; then
        ACTUAL=$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')
    else
        ACTUAL=$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')
    fi
    if [ "$ACTUAL" != "$EXPECTED" ]; then
        echo "[gh] ERROR: checksum mismatch for ${ASSET}"
        echo "[gh]   expected ${EXPECTED}"
        echo "[gh]   actual   ${ACTUAL}"
        exit 1
    fi
    echo "[gh] Checksum verified for ${ASSET}"

    # Extract based on archive type
    if [ "$ARCHIVE_EXT" = "zip" ]; then
        unzip -q "$ARCHIVE_PATH" -d "$INSTALL_TMP_DIR"
    else
        tar -xzf "$ARCHIVE_PATH" -C "$INSTALL_TMP_DIR"
    fi

    # Stage in the destination directory, then rename atomically into place.
    mkdir -p "$HOME/.local/bin"
    INSTALL_STAGING=$(mktemp "$HOME/.local/bin/.gh.XXXXXX")
    cp "${EXTRACT_DIR}/bin/gh" "$INSTALL_STAGING"
    chmod +x "$INSTALL_STAGING"
    mv -f "$INSTALL_STAGING" "$HOME/.local/bin/gh"
    INSTALL_STAGING=""

    echo "[gh] Installed to $HOME/.local/bin/gh"
fi

# Verify gh is now in PATH. Clear bash's command lookup cache first, otherwise a
# freshly installed binary can be masked by the path resolved earlier in this shell.
hash -r 2>/dev/null || true
if ! command -v gh &> /dev/null; then
    echo "[gh] ERROR: gh CLI still not found in PATH after installation"
    echo "[gh] Ensure ~/.local/bin is in your PATH"
    exit 1
fi

# Confirm the gh that PATH actually resolves meets the floor. An older gh earlier in
# PATH would otherwise shadow the pinned build we just installed.
GH_RESOLVED="$(command -v gh)"
GH_RESOLVED_VERSION="$(installed_gh_version "$GH_RESOLVED")"
if [ -n "$GH_RESOLVED_VERSION" ] && ! version_ge "$GH_RESOLVED_VERSION" "$GH_MIN_VERSION"; then
    echo "[gh] WARNING: PATH resolves gh to ${GH_RESOLVED} (v${GH_RESOLVED_VERSION}),"
    echo "[gh] which is below the required v${GH_MIN_VERSION}. The pinned build is at"
    echo "[gh] $HOME/.local/bin/gh — put ~/.local/bin ahead of ${GH_RESOLVED%/gh} in PATH."
    echo "[gh] Older gh versions leak part of the auth token via 'gh auth status' and do"
    echo "[gh] not neutralize terminal escape sequences in 'gh api'/'gh pr diff' output."
fi

# Check authentication status
if [ -n "${GH_TOKEN:-}" ]; then
    # GH_TOKEN is set, verify it works
    if gh auth status &> /dev/null; then
        echo "[gh] Authenticated successfully"
    else
        # A failed check does NOT prove the token is bad. In proxied remote
        # sessions (HTTPS_PROXY set, e.g. Claude Code cloud) the proxy can
        # intercept api.github.com, block the GraphQL query behind
        # `gh auth status`, and even swap Authorization headers — gh then
        # misreports a perfectly valid token as invalid. Retest on the direct
        # channel (proxy bypassed for GitHub hosts only) before concluding.
        NP="$(github_no_proxy)"
        if [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ] \
            && NO_PROXY="$NP" no_proxy="$NP" run_bounded gh auth status &> /dev/null; then
            echo "[gh] GH_TOKEN is VALID, but this session's proxy intercepts GitHub API calls"
            echo "[gh] ('gh auth status' fails through the proxy and misreports the token as invalid)."
            echo "[gh] To use gh in this session, bypass the proxy for GitHub hosts only"
            echo "[gh] (keep HTTPS_PROXY set; never disable TLS verification):"
            echo '[gh]   export NO_PROXY="'"${GITHUB_DIRECT_HOSTS}"'${NO_PROXY:+,$NO_PROXY}"'
            echo '[gh]   export no_proxy="$NO_PROXY"'
            echo "[gh] Agent harnesses often reset shell state between tool calls; if the"
            echo "[gh] exports do not stick, prefix each command instead:"
            echo '[gh]   NO_PROXY="'"${GITHUB_DIRECT_HOSTS}"'" no_proxy="'"${GITHUB_DIRECT_HOSTS}"'" gh <command>'
            # State the consequences here rather than only pointing at the shortcut. This
            # branch has already proven both halves of the condition (proxy intercepts
            # GitHub, direct channel is open), and at the moment these facts are needed the
            # session's own docs say the opposite. An unread pointer loses that argument.
            echo "[gh] This session's git remote may use a ref-scoped credential broker:"
            echo "[gh]   - pushes to refs/heads/* succeed; pushes to refs/tags/* fail with HTTP 403."
            echo "[gh]   - 'git push --dry-run' PASSES for tags the broker later refuses"
            echo "[gh]     (it refuses at receive-pack, after ref advertisement); it proves nothing."
            echo "[gh]   - create tags on the direct channel instead:"
            echo "[gh]       gh api repos/OWNER/REPO/git/refs -f ref=refs/tags/vX.Y.Z -f sha=SHA"
            echo "[gh]   - a GitHub-host 403 with NO x-github-request-id header is proxy-manufactured,"
            echo "[gh]     not an egress denial. Run the egress test before reporting a block."
            echo "[gh] Details: tbd shortcut setup-github-cli (Proxied Remote Sessions)"
        else
            echo "[gh] WARNING: GH_TOKEN is set but could not be verified on any channel"
            echo "[gh] Either the token is invalid/expired, or this session's network policy"
            echo "[gh] blocks GitHub API access (git push and GitHub MCP tools may still work)."
            echo "[gh] Diagnosis: tbd shortcut setup-github-cli (Proxied Remote Sessions)"
        fi
    fi
elif gh auth status &> /dev/null; then
    # No GH_TOKEN, but gh is authenticated another way (keyring after `gh auth login`,
    # or a host config). That is a fully working setup; saying "not set" here reads as a
    # problem on a healthy machine, so report what is actually true.
    echo "[gh] Authenticated (no GH_TOKEN; using stored gh credentials)"
else
    echo "[gh] NOTE: GH_TOKEN not set and no stored gh credentials found"
    echo "[gh] Run 'gh auth login', or set GH_TOKEN before starting the session."
    echo "[gh] See: tbd shortcut setup-github-cli"
fi

# Optional stacked-PR tooling (opt-in via --with-stack).
#
# Pinned per SUPPLY-CHAIN-SECURITY.md: gh-stack v0.1.0 was published 2026-07-29 and
# clears the 14-day cool-off. Both `gh extension install` and `gh skill install` accept
# --pin, so neither resolves "latest" at run time.
#
# Nothing here is fatal. Stacked PRs are one workflow among several, and a network
# failure while fetching an optional extension must never block a session.
GH_STACK_REPO="github/gh-stack"
GH_STACK_VERSION="v0.1.0"

# The skill is pinned by commit SHA rather than the tag. A tag can be moved, and a skill
# is not inert data: it is instructions loaded into every later agent session on this
# machine, so it deserves the stricter pin. This is the commit v0.1.0 points at, which
# `gh skill install` also prints when it resolves the tag.
GH_STACK_SKILL_SHA="a1b4a3d4d0bcde9ec3a78ab99b2d63af121857a9"
GH_SKILL_AGENT="${GH_SKILL_AGENT:-claude-code}"

# Is the gh-stack skill present for this agent? Used both as the pre-check and as the
# post-install verification, because `gh skill install` exit status cannot be trusted
# (see below).
gh_stack_skill_present() {
    gh skill list --agent "$GH_SKILL_AGENT" --json skillName -q '.[].skillName' 2>/dev/null \
        | grep -qx 'gh-stack'
}

if [ "$WITH_STACK" = "1" ]; then
    if gh extension list 2>/dev/null | grep -q "gh stack"; then
        echo "[gh] gh-stack extension already installed"
    elif gh extension install "$GH_STACK_REPO" --pin "$GH_STACK_VERSION" 2>&1 | sed 's/^/[gh]   /'; then
        echo "[gh] Installed ${GH_STACK_REPO} extension (pinned ${GH_STACK_VERSION})"
    else
        echo "[gh] WARNING: could not install the ${GH_STACK_REPO} extension"
        echo "[gh] Stacked-PR commands will be unavailable; everything else still works."
    fi

    # The official agent skill teaches an agent to drive `gh stack` non-interactively,
    # which matters because several subcommands open a blocking TUI under a PTY.
    #
    # User scope on purpose, for consistency: `gh extension install` above is already
    # machine-global, so a per-repo skill would be incoherent with it, and project scope
    # would write skill files into the user's repo. The opt-in gate is --with-stack, not
    # the scope. Note `gh skill` has no uninstall command: removal means deleting the
    # installed directory (see `gh skill list` for its location).
    #
    # The skill NAME is required. Given only a repository, `gh skill install` prints the
    # skills it found, installs nothing, and still exits 0, so a bare repo argument
    # silently does nothing while looking like success. Verify the result rather than
    # trusting the exit status.
    if gh_stack_skill_present; then
        echo "[gh] gh-stack agent skill already installed"
    else
        gh skill install "$GH_STACK_REPO" gh-stack --pin "$GH_STACK_SKILL_SHA" \
            --agent "$GH_SKILL_AGENT" --scope user --force 2>&1 | sed 's/^/[gh]   /' || true
        if gh_stack_skill_present; then
            echo "[gh] Installed the gh-stack agent skill (${GH_SKILL_AGENT}, user scope)"
            echo "[gh] GitHub does not verify skills, and a skill is instructions that load"
            echo "[gh] into later sessions. Review it before relying on it:"
            echo "[gh]   gh skill preview ${GH_STACK_REPO} gh-stack@${GH_STACK_SKILL_SHA}"
        else
            echo "[gh] WARNING: the gh-stack agent skill did not install"
            echo "[gh] The extension may still work; see: tbd shortcut stacked-prs"
        fi
    fi
fi

exit 0
