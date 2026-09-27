import argparse
import os
import re
import sys
from pathlib import Path

# Directories to ignore by default
DEFAULT_IGNORE_DIRS = {
    ".git", ".svn", ".hg", ".idea", ".vscode", ".dart_tool", "node_modules",
    "__pycache__", "build", "dist", "out", ".venv", "venv", "env", ".gradle",
    "Pods", "coverage", "l10n","md","data","tests","dashboard","graphify-out","temp",
    "docs","reviews","dist"
}

# Specific filenames to ignore by default
DEFAULT_IGNORE_FILES = {
    ".DS_Store", "Thumbs.db", ".gitignore", ".gitattributes", ".dockerignore",
    ".env", ".env.local", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "AGENT.md", "tree.md","main.ipnyb","generate_ml_dataset.ipynb","a.md","a.xml",
    "a.json","main.ipynb","vue.global.prod.js","vis-network.min.js","tailwindcss.js",
    # "README.md",
    "README_V2.md","chatgbt_review.md",
    # "CLAUDE.md"
}

# Binary, media, generated files, or specific suffixes to ignore by default
DEFAULT_IGNORE_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
    ".mp3", ".mp4", ".mov", ".avi", ".flv", ".wav",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    ".pyc", ".pyo", ".pyd", ".db", ".sqlite", ".class",
    ".lock", ".jar", ".freezed.dart", ".g.dart",".json1",".i.py",".jsonl",".md"
}

# Extension to Markdown language mapping
LANG_MAP = {
    ".py": "python",
    ".dart": "dart",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".sh": "bash",
    ".bash": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".sql": "sql",
    ".xml": "xml",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".toml": "toml",
    ".ini": "ini",
    ".txt": "text",
    ".csv": "csv"
}


def is_binary(file_path: Path) -> bool:
    """Detect if a file is binary by checking for null bytes in initial chunk."""
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            return b"\x00" in chunk
    except Exception:
        return True


def is_ignored_file(file_path: Path) -> bool:
    """Check if file matches any ignored filename, extension/suffix pattern, or is binary."""
    name_lower = file_path.name.lower()
    if name_lower in {f.lower() for f in DEFAULT_IGNORE_FILES}:
        return True
    for pattern in DEFAULT_IGNORE_EXTS:
        if name_lower.endswith(pattern.lower()):
            return True
    return is_binary(file_path)


GLOB_CHARS = ("*", "?", "[")


def split_file_patterns(raw_values) -> list[str]:
    """Flatten repeated --files values, which may be comma/space/semicolon separated."""
    if not raw_values:
        return []

    patterns = []
    for value in raw_values:
        for part in re.split(r"[,\s;]+", value.strip().strip('"\'')):
            if part:
                patterns.append(part)
    return patterns


def _resolve_case_insensitive(base: Path, relative: Path) -> Path | None:
    """Walk `relative` segment by segment, matching names case-insensitively."""
    current = base
    for part in relative.parts:
        try:
            entries = {e.name.lower(): e for e in current.iterdir()}
        except OSError:
            return None
        current = entries.get(part.lower())
        if current is None:
            return None
    return current


def resolve_file_selection(target_path: Path, patterns: list[str]) -> tuple[set[Path], list[str]]:
    """Map --files patterns to absolute file paths inside `target_path`.

    Literal paths are resolved directly, a directory expands to every file
    beneath it, and patterns containing wildcards are expanded with Path.glob.
    Matching is case-insensitive so the flag behaves the same on case-sensitive
    and case-insensitive filesystems.

    Returns (selected, missing) where `missing` lists patterns that matched
    nothing so the caller can report them.
    """
    selected: set[Path] = set()
    missing: list[str] = []

    def _absorb(candidate: Path) -> None:
        if candidate.is_dir():
            for root, _, names in os.walk(candidate):
                for name in names:
                    selected.add((Path(root) / name).resolve())
        elif candidate.is_file():
            selected.add(candidate.resolve())

    for pattern in patterns:
        normalized = pattern.replace("\\", "/")
        pattern_path = Path(pattern)
        has_glob = any(ch in pattern for ch in GLOB_CHARS)

        if has_glob:
            if pattern_path.is_absolute():
                try:
                    relative = Path(normalized).relative_to(target_path.as_posix())
                except ValueError:
                    print(
                        f"Warning: '{pattern}' is a wildcard outside the scanned directory and was ignored.",
                        file=sys.stderr,
                    )
                    missing.append(pattern)
                    continue
            else:
                relative = Path(normalized)

            matches = sorted(target_path.glob(str(relative)))
            if not matches:
                missing.append(pattern)
                continue
            for match in matches:
                _absorb(match)
            continue

        candidate = pattern_path if pattern_path.is_absolute() else target_path / pattern_path
        if not candidate.exists():
            fixed = (
                _resolve_case_insensitive(target_path, pattern_path)
                if not pattern_path.is_absolute()
                else None
            )
            if fixed is None:
                missing.append(pattern)
                continue
            candidate = fixed

        if not candidate.resolve().is_relative_to(target_path):
            print(
                f"Warning: '{pattern}' is outside the scanned directory and was ignored.",
                file=sys.stderr,
            )
            continue

        _absorb(candidate.resolve())

    return selected, missing


def strip_comments(content: str, ext: str) -> str:
    """Remove comments from file content based on file extension while preserving string literals."""
    ext = ext.lower()

    # C-style comments (// and /* */) + strings (Dart, JS, TS, C, C++, Java, Kotlin, Swift, Go, Rust, CSS, SCSS, etc.)
    if ext in {".dart", ".js", ".ts", ".jsx", ".tsx", ".c", ".cpp", ".h", ".hpp", ".java", ".kt", ".swift", ".go", ".rs", ".php", ".css", ".scss"}:
        pattern = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`|/\*[\s\S]*?\*/|//.*)'
        def replace(match):
            m = match.group(0)
            if m.startswith('//') or m.startswith('/*'):
                return ''
            return m
        result = re.sub(pattern, replace, content)

    # Python comments (#) + strings/docstrings
    elif ext in {".py"}:
        pattern = r'(""".*?"""|\'\'\'.*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|#.*)'
        def replace(match):
            m = match.group(0)
            if m.startswith('#'):
                return ''
            return m
        result = re.sub(pattern, replace, content)

    # Shell / Yaml / Toml (# comments)
    elif ext in {".sh", ".bash", ".yaml", ".yml", ".toml", ".ini", ".rb"}:
        pattern = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|#.*)'
        def replace(match):
            m = match.group(0)
            if m.startswith('#'):
                return ''
            return m
        result = re.sub(pattern, replace, content)

    # HTML / XML comments (<!-- ... -->)
    elif ext in {".html", ".xml", ".svg"}:
        result = re.sub(r'<!--[\s\S]*?-->', '', content)

    # SQL comments (-- and /* */)
    elif ext in {".sql"}:
        pattern = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|/\*[\s\S]*?\*/|--.*)'
        def replace(match):
            m = match.group(0)
            if m.startswith('--') or m.startswith('/*'):
                return ''
            return m
        result = re.sub(pattern, replace, content)
    else:
        return content

    # Clean up empty lines left by comment removal
    lines = [line for line in result.splitlines() if line.strip() != '']
    return '\n'.join(lines)


def build_tree(target_path: Path, exclude: Path = None) -> str:
    """Build an ASCII tree representation of the directory hierarchy."""
    try:
        rel = target_path.relative_to(Path.cwd())
        root_name = rel.as_posix()
        if root_name == ".":
            root_name = target_path.name
    except ValueError:
        root_name = target_path.name

    lines = [f"{root_name}/"]

    def _add_nodes(dir_path: Path, prefix: str = ""):
        try:
            entries = sorted(list(dir_path.iterdir()), key=lambda x: (not x.is_dir(), x.name.lower()))
        except Exception:
            return

        entries = [
            e for e in entries
            if e.name not in DEFAULT_IGNORE_DIRS and not e.name.startswith(".")
            and (e.is_dir() or not is_ignored_file(e))
            and (exclude is None or e.resolve() != exclude)
        ]

        for i, entry in enumerate(entries):
            is_last = (i == len(entries) - 1)
            connector = "└── " if is_last else "├── "

            if entry.is_dir():
                lines.append(f"{prefix}{connector}{entry.name}/")
                _add_nodes(entry, prefix + ("    " if is_last else "│   "))
            else:
                lines.append(f"{prefix}{connector}{entry.name}")

    _add_nodes(target_path)
    return "\n".join(lines)


OUTPUT_DIR = "md"


def resolve_output_path(target_path: Path, output_file: str = None) -> Path:
    """Resolve the destination markdown file.

    Reports land in the `md` folder beside the working directory, so
    `python g.py src` produces `md/src.md`. A bare filename passed to --out is
    placed there too; a value containing a directory component is honoured as
    given. When the `md` folder cannot be created the report falls back to the
    working directory instead of failing.
    """
    try:
        rel_dir = target_path.relative_to(Path.cwd())
        name_parts = [p for p in rel_dir.parts if p and p != "."]
        dir_name = "_".join(name_parts) if name_parts else target_path.name
    except ValueError:
        dir_name = target_path.name

    out_name = None
    if not output_file:
        out_name = f"{dir_name}.md"
    else:
        out_p = Path(output_file.strip().strip('"\''))
        out_name = out_p.name if out_p.parent == Path(".") else None

    if out_name is None:
        # Explicit destination: honour it exactly, failures are the user's to see.
        output_path = out_p.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        return output_path

    output_path = (Path(OUTPUT_DIR) / out_name).resolve()
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        output_path = (Path.cwd() / out_name).resolve()

    return output_path


def generate_md(target_dir: str, output_file: str = None, remove_comments: bool = True, structure_only: bool = False, collapse: bool = False, only_files: list[str] = None):
    # Sanitize input directory path
    target_dir_clean = target_dir.strip().strip('"\'')
    target_path = Path(target_dir_clean).resolve()

    if not target_path.exists():
        print(f"Error: Directory '{target_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)
    if not target_path.is_dir():
        print(f"Error: '{target_dir}' is not a directory.", file=sys.stderr)
        sys.exit(1)

    output_path = resolve_output_path(target_path, output_file)

    # Resolve an explicit --files selection up front so a total miss fails
    # before an empty report is created. An empty/absent list means no filter.
    selected = None
    if only_files:
        selected, missing = resolve_file_selection(target_path, only_files)
        for pattern in missing:
            print(f"Warning: --files pattern '{pattern}' matched no file.", file=sys.stderr)
        if not selected:
            print("Error: none of the --files patterns matched any file.", file=sys.stderr)
            sys.exit(1)
        selected.discard(output_path)

    processed_files = []
    skipped_count = 0

    print(f"Scanning directory: {target_path} ...")

    with open(output_path, "w", encoding="utf-8") as out:
        title_label = "Directory Structure" if structure_only else "Directory Contents"
        out.write(f"# {title_label}: `{target_path.name}`\n\n")
        out.write(f"- **Source Folder**: `{target_path}`\n")
        if not structure_only:
            out.write(f"- **Comments Ignored**: {'Yes' if remove_comments else 'No'}\n")
            out.write(f"- **Collapsible**: {'Yes' if collapse else 'No'}\n")
            if only_files:
                out.write(f"- **File Filter**: `{', '.join(only_files)}` (directory tree stays complete)\n")
        out.write("\n")

        # Write Directory Tree
        out.write("## Directory Tree\n\n```\n")
        out.write(build_tree(target_path, exclude=output_path))
        out.write("\n```\n\n")

        # If structure only, stop here without file list or file contents
        if structure_only:
            print(f"Done! Successfully generated directory structure to '{output_path}'.")
            return

        out.write("---\n\n")

        # Collect files for content dumping
        files_to_process = []
        for root, dirs, files in os.walk(target_path):
            # Filter directories in-place to avoid descending into ignored folders.
            # An explicit --files selection is honoured even inside ignored folders.
            if selected is None:
                dirs[:] = [d for d in dirs if d not in DEFAULT_IGNORE_DIRS and not d.startswith(".")]

            for file in sorted(files):
                file_path = (Path(root) / file).resolve()

                # Skip output file if saved within the target directory
                if file_path == output_path:
                    continue

                if selected is not None:
                    if file_path not in selected:
                        continue
                    # Explicit selection bypasses the ignore rules, but binary
                    # content still cannot be embedded as text.
                    if is_binary(file_path):
                        print(f"Warning: '{file_path}' is binary and was skipped.", file=sys.stderr)
                        skipped_count += 1
                        continue
                elif is_ignored_file(file_path):
                    skipped_count += 1
                    continue

                files_to_process.append(file_path)

        if selected is not None:
            files_to_process.sort(key=lambda p: p.relative_to(target_path).as_posix())

        # Write content for each file
        for file_path in files_to_process:
            rel_path = file_path.relative_to(target_path)
            ext = file_path.suffix.lower()
            lang = LANG_MAP.get(ext, "")

            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                if remove_comments:
                    content = strip_comments(content, ext)

                if collapse:
                    out.write(f"<details>\n<summary><b>File: <code>{rel_path}</code></b></summary>\n\n")
                    out.write(f"```{lang}\n")
                    out.write(content)
                    if not content.endswith("\n"):
                        out.write("\n")
                    out.write("```\n\n</details>\n\n---\n\n")
                else:
                    out.write(f"## File: `{rel_path}`\n\n")
                    out.write(f"```{lang}\n")
                    out.write(content)
                    if not content.endswith("\n"):
                        out.write("\n")
                    out.write("```\n\n---\n\n")

                processed_files.append(rel_path)
            except Exception as e:
                print(f"Warning: Could not read {rel_path}: {e}", file=sys.stderr)
                skipped_count += 1

    print(f"Done! Successfully wrote {len(processed_files)} file(s) to '{output_path}'.")
    if skipped_count > 0:
        print(f"Skipped {skipped_count} binary or ignored file(s).")


def main():
    parser = argparse.ArgumentParser(
        description="Recursively read all text files in a directory and consolidate them into a single Markdown file.",
        epilog=(
            "examples:\n"
            "  python g.py src/                     write md/src.md\n"
            "  python g.py src/ -o docs/all.md      write to an explicit path\n"
            "  python g.py src/ -o all.md           write md/all.md\n"
            "  python g.py src/ --str               folder tree only\n"
            "  python g.py src/ -f 'main.py,lib/*'  export only matching files\n"
            "  python g.py -f 'main.py'             DIR optional, resolves against cwd\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=None,
        metavar="DIR",
        help="Directory to scan. Optional only when --files is given, in which "
             "case the file patterns resolve against the current directory."
    )
    parser.add_argument(
        "--out",
        "-o",
        default=None,
        help=f"Output Markdown file. Default: {OUTPUT_DIR}/<dir_name>.md. "
             "A bare filename is also written into that folder; a value with a "
             "directory component is written there instead."
    )
    parser.add_argument(
        "--files",
        "-f",
        action="append",
        default=None,
        metavar="PATTERNS",
        help="Export only these files instead of the whole directory. Comma/space "
             "separated and repeatable. Paths are relative to DIR, a directory "
             "expands to everything inside it, and * ? wildcards are supported. "
             "Explicitly named files bypass the default ignore rules. The "
             "directory tree still shows the full folder."
    )
    parser.add_argument(
        "--str",
        "-s",
        action="store_true",
        help="Structure only: output folder tree without file list or file contents."
    )
    parser.add_argument(
        "--keep-comments",
        action="store_true",
        help="Keep comments in source files (by default, comments are ignored/stripped)."
    )
    parser.add_argument(
        "--collapse",
        "-c",
        action="store_true",
        help="Make file contents collapsible using HTML <details> tags."
    )

    args = parser.parse_args()
    only_files = split_file_patterns(args.files)

    # DIR is required unless --files narrows the export down to specific paths,
    # in which case those patterns resolve against the current directory.
    if args.directory is not None:
        directory = args.directory
    elif only_files:
        directory = "."
    else:
        parser.error("DIR is required (or pass --files to export specific files)")

    generate_md(
        directory,
        args.out,
        remove_comments=not args.keep_comments,
        structure_only=args.str,
        collapse=args.collapse,
        only_files=only_files
    )


if __name__ == "__main__":
    main()
