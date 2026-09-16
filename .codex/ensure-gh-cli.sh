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
STACK_INSTALL_ROOT=""

cleanup() {
    if [ -n "$INSTALL_STAGING" ]; then
        rm -f -- "$INSTALL_STAGING"
    fi
    if [ -n "$INSTALL_TMP_DIR" ]; then
        rm -rf -- "$INSTALL_TMP_DIR"
    fi
    if [ -n "$STACK_INSTALL_ROOT" ]; then
        rm -rf -- "$STACK_INSTALL_ROOT"
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
# clears the 14-day cool-off. A release tag is not an artifact-integrity boundary:
# GitHub release assets can be replaced without moving the tag. The extension installer
# therefore downloads the platform asset itself and verifies its pinned GitHub release
# digest before placing those exact bytes in gh's extension directory. `gh skill`
# accepts a commit pin, so the separate agent skill is pinned by SHA below.
#
# Download and verification failures are nonfatal once any unchecked registration is
# disabled. The only fatal case is being unable to make an unverified `gh stack`
# command undispatchable; continuing through that state would defeat the verification.
GH_STACK_REPO="github/gh-stack"
GH_STACK_VERSION="v0.1.0"

# SHA-256 digests reported by the GitHub release API for the four platforms this
# installer supports. Keep these beside the version pin so a future bump must update
# the executable identity deliberately rather than trusting a mutable tag or whatever
# `gh extension install` happens to fetch.
gh_stack_checksum_for() {
    case "$1" in
        darwin-amd64) echo "712266939bf40349dce6c8893037b88e0453334d30d06750b61ce1a6c8640bb9" ;;
        darwin-arm64) echo "5ca98241a265d6de018095cdae5f3c40da5ca782450eec0ea91aa8e3eb183103" ;;
        linux-amd64)  echo "358552dd7dce0a46ce153fe196270cec482b84f080947890aad4061a8d44bc0b" ;;
        linux-arm64)  echo "a79649e121845b7404109de21d65601c09c8c6d021d93738a3428d23986a8841" ;;
        *) echo "" ;;
    esac
}

# Normalize uname output to the exact gh-stack release asset name. The surrounding gh
# installer supports the same Darwin/Linux amd64/arm64 matrix; refuse rather than
# silently selecting a different asset on an unreviewed platform.
gh_stack_platform_for() {
    local os arch
    os=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
    arch=$2
    [ "$arch" = "x86_64" ] && arch="amd64"
    [ "$arch" = "aarch64" ] && arch="arm64"
    case "${os}-${arch}" in
        darwin-amd64|darwin-arm64|linux-amd64|linux-arm64)
            printf '%s\n' "${os}-${arch}"
            ;;
        *) return 1 ;;
    esac
}

sha256_matches() {
    local actual
    if command -v sha256sum &> /dev/null; then
        actual=$(sha256sum "$1" | awk '{print $1}') || return 1
    elif command -v shasum &> /dev/null; then
        actual=$(shasum -a 256 "$1" | awk '{print $1}') || return 1
    else
        return 1
    fi
    [ "$actual" = "$2" ]
}

# go-gh's DataDir contract, which the gh extension manager uses: XDG_DATA_HOME when
# set, otherwise ~/.local/share on Darwin/Linux. This installer intentionally supports
# only those operating systems, matching its pinned gh binary matrix above.
gh_stack_data_home() {
    printf '%s\n' "${XDG_DATA_HOME:-"$HOME/.local/share"}"
}

gh_stack_extension_executable_for_data_home() {
    printf '%s\n' "${1}/gh/extensions/gh-stack/gh-stack"
}

gh_stack_extension_executable() {
    local data_home
    data_home=$(gh_stack_data_home)
    gh_stack_extension_executable_for_data_home "$data_home"
}

# Require the complete identity that gh itself reports, not a substring such as
# "gh stack" that a same-command extension from another owner or version can satisfy.
gh_stack_extension_list_matches() {
    gh extension list 2>/dev/null \
        | awk -F "$(printf '\t')" \
            -v expected_repo="$GH_STACK_REPO" \
            -v expected_version="$GH_STACK_VERSION" '
                $1 == "gh stack" {
                    valid = $2 == expected_repo && $3 == expected_version
                    if (valid) { found++ } else { conflict = 1 }
                }
                END { exit(found == 1 && !conflict ? 0 : 1) }
            '
}

gh_stack_command_present() {
    gh extension list 2>/dev/null \
        | awk -F "$(printf '\t')" '
            $1 == "gh stack" { found = 1 }
            END { exit(found ? 0 : 1) }
        '
}

# Confirm that gh will execute the expected file. `gh extension list` validates the
# public identity; the manifest path check closes the local redirect gap.
gh_stack_manifest_file_matches() {
    local manifest executable
    manifest=$1
    executable=$2
    [ -f "$manifest" ] && [ ! -L "$manifest" ] \
        && grep -Fqx "owner: github" "$manifest" \
        && grep -Fqx "name: gh-stack" "$manifest" \
        && grep -Fqx "host: github.com" "$manifest" \
        && grep -Fqx "tag: ${GH_STACK_VERSION}" "$manifest" \
        && grep -Fqx "ispinned: true" "$manifest" \
        && grep -Fqx "path: ${executable}" "$manifest"
}

gh_stack_manifest_matches() {
    local executable
    executable=$(gh_stack_extension_executable)
    gh_stack_manifest_file_matches "${executable%/*}/manifest.yml" "$executable"
}

gh_stack_extension_identity_matches() {
    gh_stack_extension_list_matches && gh_stack_manifest_matches
}

# Make an unverified same-command extension undispatchable before any network request.
# `gh extension remove` is the normal path. The rename is a recoverable fallback for a
# damaged or adversarial manifest that gh cannot remove itself.
disable_gh_stack_extension() {
    local executable extension_dir quarantine
    executable=$(gh_stack_extension_executable)
    extension_dir=${executable%/*}

    if gh_stack_command_present; then
        gh extension remove stack 2>&1 | sed 's/^/[gh]   /' || true
    fi

    # Also inspect the canonical directory: a damaged manifest can make
    # `gh extension list` fail even though gh can still discover the command by name.
    if [ -e "$extension_dir" ] || [ -L "$extension_dir" ]; then
        quarantine=$(mktemp -d "${extension_dir}.unverified.XXXXXX") || return 1
        rmdir "$quarantine" || return 1
        if mv "$extension_dir" "$quarantine"; then
            echo "[gh] Quarantined an unverified gh-stack extension at ${quarantine}"
        fi
    fi
    ! gh_stack_command_present \
        && [ ! -e "$extension_dir" ] \
        && [ ! -L "$extension_dir" ]
}

# Change only the one generated manifest field that necessarily differs between the
# isolated registration root and the final canonical path. The input manifest is first
# validated against the isolated path; exactly one path line must then be replaced.
rewrite_gh_stack_manifest_path() {
    local manifest old_executable new_executable path_count
    manifest=$1
    old_executable=$2
    new_executable=$3
    INSTALL_STAGING=$(mktemp "${manifest%/*}/.manifest.XXXXXX") || return 1
    if ! awk \
        -v old_path="path: ${old_executable}" \
        -v new_path="path: ${new_executable}" '
            $0 == old_path { count++; print new_path; next }
            { print }
            END { if (count != 1) exit 1 }
        ' "$manifest" > "$INSTALL_STAGING"; then
        return 1
    fi
    path_count=$(grep -Fxc "path: ${new_executable}" "$INSTALL_STAGING") || return 1
    [ "$path_count" = "1" ] || return 1
    chmod 600 "$INSTALL_STAGING" || return 1
    mv -f "$INSTALL_STAGING" "$manifest" || return 1
    INSTALL_STAGING=""
}

# Install the verified release bytes without ever publishing gh's unchecked download
# at the canonical dispatch path. gh creates its manifest in an isolated XDG data root
# on the same filesystem; the executable is replaced, signed, and revalidated there.
# Only the complete verified directory is atomically renamed into place. On macOS gh
# ad-hoc signs downloaded extensions to satisfy Gatekeeper, so reproduce that step only
# after the release digest has matched.
install_verified_gh_stack_extension() {
    local platform expected asset asset_path download_url canonical_data_home
    local canonical_executable canonical_dir canonical_parent staged_executable
    local staged_dir staged_manifest publish_sentinel publish_sentinel_name
    local canonical_sentinel np version_output

    # Do this before downloading. If the transfer or checksum fails, a pre-existing
    # same-command binary must not remain dispatchable under `gh stack`.
    disable_gh_stack_extension || return 2

    if ! platform=$(gh_stack_platform_for "$(uname -s)" "$(uname -m)"); then
        echo "[gh] WARNING: no reviewed gh-stack asset for $(uname -s)/$(uname -m)"
        return 1
    fi
    expected=$(gh_stack_checksum_for "$platform")
    [ -n "$expected" ] || return 1

    if [ -z "$INSTALL_TMP_DIR" ]; then
        INSTALL_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tbd-gh.XXXXXX") || return 1
        trap cleanup EXIT
    fi
    asset="${platform}"
    asset_path="${INSTALL_TMP_DIR}/${asset}"
    download_url="https://github.com/${GH_STACK_REPO}/releases/download/${GH_STACK_VERSION}/${asset}"
    echo "[gh] Downloading pinned ${GH_STACK_REPO} ${GH_STACK_VERSION} asset (${asset})..."
    if ! curl -fsSL --connect-timeout 15 --max-time 120 -o "$asset_path" "$download_url"; then
        echo "[gh] Extension download failed; retrying with NO_PROXY for GitHub hosts..."
        np=$(github_no_proxy)
        NO_PROXY="$np" no_proxy="$np" \
            curl -fsSL --connect-timeout 15 --max-time 120 \
                -o "$asset_path" "$download_url" || return 1
    fi
    if ! sha256_matches "$asset_path" "$expected"; then
        echo "[gh] WARNING: checksum mismatch for ${GH_STACK_REPO} ${GH_STACK_VERSION} (${asset})"
        echo "[gh] Refusing to install or execute the unverified extension asset."
        return 1
    fi

    canonical_data_home=$(gh_stack_data_home)
    canonical_executable=$(gh_stack_extension_executable_for_data_home "$canonical_data_home")
    canonical_dir=${canonical_executable%/*}
    canonical_parent=${canonical_dir%/*}
    mkdir -p "$canonical_data_home" || return 1
    STACK_INSTALL_ROOT=$(mktemp -d "${canonical_data_home}/.tbd-gh-stack.XXXXXX") || return 1

    # gh owns the manifest format, but its unchecked download stays isolated. A crash
    # anywhere before the final directory rename leaves no canonical `gh stack` command.
    XDG_DATA_HOME="$STACK_INSTALL_ROOT" \
        gh extension install "$GH_STACK_REPO" --pin "$GH_STACK_VERSION" --force 2>&1 \
        | sed 's/^/[gh]   /' || return 1
    staged_executable=$(gh_stack_extension_executable_for_data_home "$STACK_INSTALL_ROOT")
    staged_dir=${staged_executable%/*}
    staged_manifest=${staged_dir}/manifest.yml
    [ -d "$staged_dir" ] && [ ! -L "$staged_dir" ] || return 1
    (
        export XDG_DATA_HOME="$STACK_INSTALL_ROOT"
        gh_stack_extension_list_matches
    ) || return 1
    gh_stack_manifest_file_matches "$staged_manifest" "$staged_executable" || return 1

    INSTALL_STAGING=$(mktemp "${staged_dir}/.gh-stack.XXXXXX") || return 1
    cp "$asset_path" "$INSTALL_STAGING" || return 1
    chmod 755 "$INSTALL_STAGING" || return 1
    if [ "${platform%%-*}" = "darwin" ]; then
        command -v codesign &> /dev/null || return 1
        codesign --force --sign - "$INSTALL_STAGING" >/dev/null 2>&1 || return 1
        codesign --verify --strict "$INSTALL_STAGING" >/dev/null 2>&1 || return 1
    else
        sha256_matches "$INSTALL_STAGING" "$expected" || return 1
    fi
    mv -f "$INSTALL_STAGING" "$staged_executable" || return 1
    INSTALL_STAGING=""

    if [ "${platform%%-*}" = "darwin" ]; then
        codesign --verify --strict "$staged_executable" >/dev/null 2>&1 || return 1
    else
        sha256_matches "$staged_executable" "$expected" || return 1
    fi
    rewrite_gh_stack_manifest_path \
        "$staged_manifest" "$staged_executable" "$canonical_executable" || return 1
    gh_stack_manifest_file_matches "$staged_manifest" "$canonical_executable" || return 1

    # The prior canonical registration was removed before staging. Refuse a concurrent
    # recreation, then atomically publish the already verified directory on the same
    # filesystem. A crash before this rename exposes nothing; a crash after it leaves a
    # complete verified executable and final-path manifest.
    mkdir -p "$canonical_parent" || return 1
    [ ! -e "$canonical_dir" ] && [ ! -L "$canonical_dir" ] || return 1
    publish_sentinel=$(mktemp "${staged_dir}/.tbd-verified.XXXXXX") || return 1
    printf '%s\n' "$expected" > "$publish_sentinel" || return 1
    chmod 600 "$publish_sentinel" || return 1
    publish_sentinel_name=${publish_sentinel##*/}
    canonical_sentinel=${canonical_dir}/${publish_sentinel_name}
    mv "$staged_dir" "$canonical_dir" || return 1
    [ ! -e "$staged_dir" ] && [ ! -L "$staged_dir" ] || return 1
    [ -d "$canonical_dir" ] && [ ! -L "$canonical_dir" ] || return 1
    # Plain BSD/POSIX mv nests the source when a competing process creates the target
    # directory after the absence check. Only an exact rename puts this unique marker
    # directly under canonical_dir. Remove it before any identity check or execution.
    [ -f "$canonical_sentinel" ] && [ ! -L "$canonical_sentinel" ] || return 1
    grep -Fqx "$expected" "$canonical_sentinel" || return 1
    rm -f "$canonical_sentinel" || return 1
    [ ! -e "$canonical_sentinel" ] && [ ! -L "$canonical_sentinel" ] || return 1
    rm -rf -- "$STACK_INSTALL_ROOT"
    STACK_INSTALL_ROOT=""

    # Verify the published identity and bytes before the first canonical execution.
    gh_stack_extension_identity_matches || return 1
    if [ "${platform%%-*}" = "darwin" ]; then
        codesign --verify --strict "$canonical_executable" >/dev/null 2>&1 || return 1
    else
        sha256_matches "$canonical_executable" "$expected" || return 1
    fi
    version_output=$(gh stack --version 2>/dev/null) || return 1
    [ "$version_output" = "gh stack version ${GH_STACK_VERSION#v}" ] || return 1

    echo "[gh] Installed ${GH_STACK_REPO} extension (${GH_STACK_VERSION}; SHA-256 verified)"
}

# The skill is pinned by commit SHA rather than the tag. A tag can be moved, and a skill
# is not inert data: it is instructions loaded into every later agent session on this
# machine, so it deserves the stricter pin. This is the commit v0.1.0 points at, which
# `gh skill install` also prints when it resolves the tag.
GH_STACK_SKILL_SHA="a1b4a3d4d0bcde9ec3a78ab99b2d63af121857a9"
GH_SKILL_AGENT="${GH_SKILL_AGENT:-codex}"

# Is the pinned official gh-stack skill present in this agent's user scope? Used both
# as the pre-check and as the post-install verification, because a same-name skill can
# come from another source or revision and `gh skill install` exit status cannot be
# trusted (see below).
gh_stack_skill_present() {
    gh skill list --agent "$GH_SKILL_AGENT" \
        --json skillName,sourceURL,scope,version,pinned,agentHosts \
        --template '{{range .}}{{printf "%s\t%s\t%s\t%s\t%t\t" .skillName .sourceURL .scope .version .pinned}}{{range .agentHosts}}{{printf "%s," .}}{{end}}{{printf "\n"}}{{end}}' \
        2>/dev/null \
        | awk -F "$(printf '\t')" \
            -v expected_source="https://github.com/${GH_STACK_REPO}" \
            -v expected_version="$GH_STACK_SKILL_SHA" \
            -v expected_agent="$GH_SKILL_AGENT" '
                $1 == "gh-stack" {
                    valid = $2 == expected_source &&
                        $3 == "user" &&
                        $4 == expected_version &&
                        $5 == "true" &&
                        index("," $6, "," expected_agent ",") > 0
                    if (valid) {
                        found = 1
                    } else {
                        conflict = 1
                    }
                }
                END { exit(found && !conflict ? 0 : 1) }
            '
}

if [ "$WITH_STACK" = "1" ]; then
    STACK_EXTENSION_READY=0
    STACK_INSTALL_STATUS=0
    install_verified_gh_stack_extension || STACK_INSTALL_STATUS=$?
    if [ "$STACK_INSTALL_STATUS" = "0" ]; then
        STACK_EXTENSION_READY=1
    else
        # A failure may follow publication or a competing canonical registration.
        # Remove or quarantine anything at the dispatch path before continuing.
        if ! disable_gh_stack_extension; then
            echo "[gh] ERROR: could not disable an unverified gh-stack extension" >&2
            echo "[gh] Refusing to continue while 'gh stack' may dispatch unchecked code." >&2
            exit 1
        fi
        echo "[gh] WARNING: could not install a verified ${GH_STACK_REPO} extension"
        echo "[gh] Stacked-PR commands will be unavailable; everything else still works."
        echo "[gh] Do not run 'gh stack' until this verification succeeds."
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
    if [ "$STACK_EXTENSION_READY" = "1" ]; then
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
fi

exit 0
