#!/usr/bin/env python3
"""Serve Kraken Keepers on localhost and open it in the default browser.

The preferred port comes from arcade.json (8807). If that port is taken, the
next free port in a short range is used instead.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT_SPAN = 20


def default_port() -> int:
    path = os.path.join(ROOT, "arcade.json")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    return int(data["port"])


def pick_port(start: int, span: int = PORT_SPAN, host: str = HOST) -> int:
    """Return the first port that can be bound.

    SO_REUSEADDR lets a just-stopped server reclaim its port while old
    connections sit in TIME_WAIT. A port another process is listening on
    still fails the bind, so we move on to the next one.
    """
    last = start + span - 1
    for port in range(start, start + span):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No free TCP port on {host} between {start} and {last}.")


class GameServer(ThreadingHTTPServer):
    allow_reuse_address = True


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Kraken Keepers local server")
    parser.add_argument("--port", type=int, default=None, help="Preferred port (default: arcade.json)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser window")
    args = parser.parse_args(argv)

    preferred = args.port if args.port is not None else default_port()
    port = pick_port(preferred)
    server = GameServer((HOST, port), QuietHandler)
    url = f"http://{HOST}:{port}/index.html"
    print(f"Kraken Keepers is running at {url}")
    if port != preferred:
        print(f"Port {preferred} was busy; using {port} instead.")
    sys.stdout.flush()
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:
            print(f"Could not open a browser ({exc}). Open {url} yourself.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
