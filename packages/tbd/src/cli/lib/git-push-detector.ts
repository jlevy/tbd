/**
 * Shell-aware `git push` detection for the generated closing hook.
 *
 * The closing hook runs after every Bash tool call and must decide, from the hook's
 * JSON input, whether the command ran `git push`. A substring or glob test misses
 * common forms (`git -C dir push`, `env VAR=1 git push`, a push on the second line)
 * and fires on others that never push (`echo git push`). This program tokenizes the
 * command the way a shell separates commands and words, and reports a push only when
 * `git push` is the command itself, after any assignments, decorators such as `env` or
 * `command`, and git's global options.
 *
 * A literal script passed to `eval` or to `sh`, `bash`, `dash`, `ksh`, or `zsh` with
 * `-c` runs as a command, so the detector parses it the same way, without executing
 * anything, to a fixed nesting depth. A script that is only known at run time, such as
 * `eval "$cmd"`, cannot be classified. The tokenizer follows quotes but not heredocs,
 * `$(...)`, `$'...'`, or comments; when a quote character in one of them leaves it
 * inside a quote at the end of the command, it has misread the rest, so the detector
 * then also reports a push when the text has `git push` at the start of a command. It
 * errs toward a spurious reminder rather than a missed one.
 *
 * The source is embedded in the generated hook and run with `node -e`, so the hook
 * needs no jq and no file outside the script. It prints `yes` or `no`, and exits 1
 * with a message on stderr when the input is not valid hook JSON, so a broken hook
 * input fails visibly instead of silently skipping the reminder.
 *
 * Embedding constraints, checked by tests: the source is placed inside single quotes
 * in Bash, so it never contains a single quote (it builds one with
 * `String.fromCharCode(39)`), and it is a raw template, so it contains no backtick
 * and no `${`.
 */
export const GIT_PUSH_DETECTOR_JS = String.raw`const fs = require("node:fs");
const SINGLE_QUOTE = String.fromCharCode(39);
const SEPARATORS = new Set(["\n", ";", "&", "(", ")", "{", "|", "}"]);
const DECORATORS = new Set(["command", "env", "exec", "nohup", "sudo", "time"]);
const SHELLS = new Set(["bash", "dash", "ksh", "sh", "zsh"]);
const KEYWORDS = new Set(["!", "coproc", "do", "elif", "else", "if", "then", "until", "while"]);
const DECORATOR_VALUE_OPTIONS = new Set([
  "-C", "-D", "-R", "-S", "-T", "-a", "-g", "-h", "-p", "-u", "--argv0", "--chdir",
  "--chroot", "--command-timeout", "--group", "--host", "--prompt", "--split-string",
  "--unset", "--user",
]);
const GIT_VALUE_OPTIONS = new Set([
  "-C", "-c", "--config-env", "--exec-path", "--git-dir", "--namespace",
  "--super-prefix", "--work-tree",
]);
const GIT_TERMINAL_OPTIONS = new Set(["-h", "-v", "--help", "--list-cmds", "--version"]);
const SHELL_VALUE_OPTIONS = new Set(["+O", "+o", "-O", "-o", "--init-file", "--rcfile"]);
const MAX_NESTING = 4;
const TEXT_PUSH = /(?:^|[\n;&|(){}])\s*git\s+push(?:\s|$)/u;

function tokenize(command) {
  const tokens = [];
  let word = "";
  let quote = "";
  let escaped = false;
  const flush = () => {
    if (word !== "") tokens.push(word);
    word = "";
  };
  for (const char of command) {
    if (escaped) {
      if (char !== "\n") word += char;
      escaped = false;
    } else if (quote !== "") {
      if (char === quote) quote = "";
      else if (quote === "\"" && char === "\\") escaped = true;
      else word += char;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "\"" || char === SINGLE_QUOTE) {
      quote = char;
    } else if (SEPARATORS.has(char)) {
      flush();
      tokens.push(null);
    } else if (/\s/u.test(char)) {
      flush();
    } else {
      word += char;
    }
  }
  if (escaped) word += "\\";
  flush();
  return { tokens, unterminated: quote !== "" };
}

function isTerminalGitOption(token) {
  return GIT_TERMINAL_OPTIONS.has(token) || /^--(help|list-cmds|version)=/u.test(token);
}

function evalScript(words) {
  return (words[0] === "--" ? words.slice(1) : words).join(" ");
}

function shellScript(words) {
  let sawC = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === "--") return sawC && i + 1 < words.length ? words[i + 1] : "";
    if (SHELL_VALUE_OPTIONS.has(word)) i++;
    else if (/^-[A-Za-z]*c[A-Za-z]*$/u.test(word)) sawC = true;
    else if (!/^[-+]/u.test(word)) return sawC ? word : "";
  }
  return "";
}

function containsGitPush(command, depth) {
  const { tokens, unterminated } = tokenize(command);
  if (unterminated && TEXT_PUSH.test(command)) return true;
  const nestedPush = (script) =>
    depth < MAX_NESTING ? containsGitPush(script, depth + 1) : TEXT_PUSH.test(script);
  let atCommandStart = true;
  let scanningGit = false;
  let sawDecorator = false;
  let skipDecoratorValue = false;
  let skipGitValue = false;
  let script = null;
  for (const token of [...tokens, null]) {
    if (token === null) {
      if (script !== null && nestedPush(script.of(script.words))) return true;
      atCommandStart = true;
      scanningGit = false;
      sawDecorator = false;
      skipDecoratorValue = false;
      skipGitValue = false;
      script = null;
    } else if (script !== null) {
      script.words.push(token);
    } else if (scanningGit) {
      if (skipGitValue) skipGitValue = false;
      else if (token === "push") return true;
      else if (isTerminalGitOption(token)) scanningGit = false;
      else if (GIT_VALUE_OPTIONS.has(token)) skipGitValue = true;
      else if (!token.startsWith("-")) scanningGit = false;
    } else if (atCommandStart) {
      if (skipDecoratorValue) skipDecoratorValue = false;
      else if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(token) || KEYWORDS.has(token)) continue;
      else if (token === "eval") script = { of: evalScript, words: [] };
      else if (DECORATORS.has(token)) sawDecorator = true;
      else if (sawDecorator && DECORATOR_VALUE_OPTIONS.has(token)) skipDecoratorValue = true;
      else if (sawDecorator && token.startsWith("-")) continue;
      else if (token === "git" || token.endsWith("/git")) {
        scanningGit = true;
        atCommandStart = false;
      } else if (SHELLS.has(token.slice(token.lastIndexOf("/") + 1))) {
        script = { of: shellScript, words: [] };
      } else atCommandStart = false;
    }
  }
  return false;
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  console.error("[tbd] The closing hook received invalid hook JSON on stdin.");
  process.exit(1);
}
const command = input?.tool_input?.command;
process.stdout.write(typeof command === "string" && containsGitPush(command, 0) ? "yes" : "no");
`;
