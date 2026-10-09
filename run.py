"""CLI runner script for CLDS."""

import sys
from clds.cli import main

if __name__ == "__main__":
    # If user called `python run.py --category ...` instead of `python run.py search --category ...`,
    # intelligently inject 'search' subcommand for convenience.
    known_commands = ["search", "batch", "verify", "list", "export", "migrate-to-mongodb", "-h", "--help"]
    if len(sys.argv) > 1 and sys.argv[1] not in known_commands:
        sys.argv.insert(1, "search")
    main()
