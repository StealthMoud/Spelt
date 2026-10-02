"""Compatibility entry point. The vector mark is the source for every icon size."""
import pathlib
import subprocess
subprocess.run(['node', 'scripts/generate-icons.js'], cwd=pathlib.Path(__file__).resolve().parents[1], check=True)
