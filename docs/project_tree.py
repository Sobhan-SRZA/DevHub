
import os
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime


# ============================================================
# CONFIGURATION
# ============================================================

OUTPUT_FILE = "project-tree.txt"
APP_NAME = "PROJECT TREE"
VERSION = "2.0"


# ============================================================
# TERMINAL UI
# ============================================================

class UI:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"
    MAGENTA = "\033[95m"

    @staticmethod
    def color(text, color):
        return f"{color}{text}{UI.RESET}"

    @staticmethod
    def line(char="─", width=60):
        print(UI.GRAY + char * width + UI.RESET)

    @staticmethod
    def header():
        width = 60
        print()
        print(UI.CYAN + "╔" + "═" * (width - 2) + "╗" + UI.RESET)
        print(
            UI.CYAN + "║" + UI.RESET
            + UI.BOLD + UI.WHITE
            + "          PROJECT TREE GENERATOR"
            + UI.RESET
            + " " * 9
            + UI.CYAN + "║" + UI.RESET
        )
        print(
            UI.CYAN + "║" + UI.RESET
            + UI.GRAY + "             Smart Repository Explorer"
            + UI.RESET
            + " " * 7
            + UI.CYAN + "║" + UI.RESET
        )
        print(UI.CYAN + "╚" + "═" * (width - 2) + "╝" + UI.RESET)
        print(
            UI.GRAY + "  Version " + VERSION
            + "  |  Python "
            + sys.version.split()[0]
            + UI.RESET
        )
        print()

    @staticmethod
    def status(label, message, color=GREEN):
        print(
            f"  {UI.GRAY}[{UI.RESET}"
            f"{color}{label}{UI.RESET}"
            f"{UI.GRAY}]{UI.RESET} {message}"
        )

    @staticmethod
    def section(title):
        print()
        print(UI.BOLD + UI.BLUE + f"  {title}" + UI.RESET)
        print(UI.GRAY + "  " + "─" * 45 + UI.RESET)


# ============================================================
# GIT
# ============================================================

def run_git(args, cwd):
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    ).stdout


def find_project_root():
    try:
        root = run_git(
            ["rev-parse", "--show-toplevel"],
            Path.cwd(),
        ).strip()

        return Path(root)

    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def get_project_files(root):
    output = run_git(
        [
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ],
        root,
    )

    return [
        Path(item)
        for item in output.split("\0")
        if item
    ]


# ============================================================
# TREE BUILDER
# ============================================================

def build_tree(paths):
    tree = {}

    for path in paths:
        current = tree

        for part in path.parts:
            current = current.setdefault(part, {})

    return tree


def render_tree(tree, root_name):
    lines = [f"{root_name}/"]

    stats = {
        "files": 0,
        "directories": 0,
        "extensions": {},
    }

    def walk(node, prefix=""):
        items = sorted(
            node.items(),
            key=lambda item: (
                not bool(item[1]),
                item[0].lower(),
            ),
        )

        for index, (name, children) in enumerate(items):
            last = index == len(items) - 1
            branch = "└── " if last else "├── "

            is_directory = bool(children)

            if is_directory:
                stats["directories"] += 1
                label = UI.CYAN + name + "/" + UI.RESET
            else:
                stats["files"] += 1
                suffix = Path(name).suffix.lower() or "[no extension]"
                stats["extensions"][suffix] = (
                    stats["extensions"].get(suffix, 0) + 1
                )

                label = UI.WHITE + name + UI.RESET

            lines.append(prefix + branch + label)

            if is_directory:
                extension = "    " if last else "│   "
                walk(children, prefix + extension)

    walk(tree)
    return lines, stats


# ============================================================
# SUMMARY
# ============================================================

def show_summary(root, files, stats, output_path):
    UI.section("PROJECT SUMMARY")

    info = [
        ("Project", root.name),
        ("Location", str(root)),
        ("Files", str(stats["files"])),
        ("Directories", str(stats["directories"])),
        ("Ignored files", "Excluded by Git"),
        ("Output", output_path.name),
    ]

    for label, value in info:
        print(
            f"  {UI.GRAY}{label:<16}{UI.RESET}"
            f"{UI.WHITE}{value}{UI.RESET}"
        )

    UI.section("FILE EXTENSIONS")

    extensions = stats["extensions"]

    if not extensions:
        print(UI.GRAY + "  No files found." + UI.RESET)
        return

    for ext, count in sorted(
        extensions.items(),
        key=lambda item: (-item[1], item[0]),
    )[:8]:
        bar = "█" * min(count, 25)
        print(
            f"  {UI.YELLOW}{ext:<16}{UI.RESET}"
            f"{UI.CYAN}{bar}{UI.RESET} "
            f"{UI.WHITE}{count}{UI.RESET}"
        )


# ============================================================
# MAIN
# ============================================================

def main():
    os.system("")

    UI.header()

    print(
        UI.GRAY + "  Started at "
        + datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        + UI.RESET
    )

    UI.section("INITIALIZATION")

    root = find_project_root()

    if root is None:
        UI.status(
            "ERROR",
            "Git repository not found.",
            UI.RED,
        )
        print()
        print("  Run 'git init' in your project directory first.")
        return 1

    UI.status("OK", "Git repository detected.")
    UI.status("ROOT", str(root), UI.CYAN)

    try:
        files = get_project_files(root)

        output_path = root / OUTPUT_FILE

        relative_paths = []

        for path in files:
            full_path = (root / path).resolve()

            if full_path == output_path.resolve():
                continue

            try:
                relative_paths.append(
                    full_path.relative_to(root.resolve())
                )
            except ValueError:
                continue

        tree = build_tree(relative_paths)
        tree_lines, stats = render_tree(tree, root.name)

        # Plain text output without terminal color codes.
        plain_tree = [f"{root.name}/"]

        def render_plain(node, prefix=""):
            items = sorted(
                node.items(),
                key=lambda item: (not bool(item[1]), item[0].lower()),
            )

            for index, (name, children) in enumerate(items):
                last = index == len(items) - 1
                branch = "└── " if last else "├── "
                label = name + ("/" if children else "")

                plain_tree.append(prefix + branch + label)

                if children:
                    render_plain(
                        children,
                        prefix + ("    " if last else "│   "),
                    )

        render_plain(tree)

        output_path.write_text(
            "\n".join(plain_tree) + "\n",
            encoding="utf-8",
        )

        UI.status("OK", "Project structure generated.")
        UI.status("OK", "Git ignore rules applied.")

        show_summary(root, relative_paths, stats, output_path)

        UI.section("TREE PREVIEW")

        # Show a limited preview to keep the interface readable.
        for line in tree_lines[:30]:
            print("  " + line)

        if len(tree_lines) > 30:
            print(
                UI.GRAY
                + f"\n  ... {len(tree_lines) - 30} more entries"
                + UI.RESET
            )

        UI.section("OUTPUT")

        UI.status("SUCCESS", "Tree saved successfully.")
        print(f"  {UI.GREEN}{output_path}{UI.RESET}")

        print()
        UI.line("═")
        print(
            UI.BOLD + UI.GREEN
            + "  ✓ TASK COMPLETED"
            + UI.RESET
        )
        UI.line("═")
        print()

        return 0

    except subprocess.CalledProcessError as error:
        UI.status("GIT ERROR", str(error), UI.RED)

        if error.stderr:
            print(error.stderr)

        return 1

    except Exception as error:
        UI.status(
            "ERROR",
            f"{type(error).__name__}: {error}",
            UI.RED,
        )
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
    except KeyboardInterrupt:
        print("\n" + UI.YELLOW + "  Operation cancelled." + UI.RESET)
        exit_code = 130

    print()
    input("  Press Enter to exit...")
    sys.exit(exit_code)
