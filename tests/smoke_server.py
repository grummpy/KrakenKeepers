#!/usr/bin/env python3
"""Headless check that server.py serves the game on localhost."""

from __future__ import annotations

import importlib.util
import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "127.0.0.1"
PORT = 8933


def load_server():
    path = os.path.join(ROOT, "server.py")
    spec = importlib.util.spec_from_file_location("kraken_server", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_free_port_fallback(server) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as busy:
        busy.bind((HOST, 8940))
        busy.listen(1)
        chosen = server.pick_port(8940, span=4, host=HOST)
    assert chosen == 8941, chosen


def fetch(url: str) -> tuple[int, bytes]:
    with urllib.request.urlopen(url, timeout=2) as response:
        return response.status, response.read()


def main() -> int:
    server = load_server()
    assert server.default_port() == 8807
    assert_free_port_fallback(server)

    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "server.py"), "--port", str(PORT), "--no-browser"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        deadline = time.time() + 5
        body = b""
        status = 0
        last_error = None
        while time.time() < deadline:
            if proc.poll() is not None:
                raise SystemExit(f"server exited early with {proc.returncode}")
            try:
                status, body = fetch(f"http://{HOST}:{PORT}/index.html")
                break
            except Exception as exc:  # server may still be binding
                last_error = exc
                time.sleep(0.05)
        else:
            raise SystemExit(f"server did not serve index.html: {last_error}")

        text = body.decode("utf-8")
        assert status == 200, status
        assert "<canvas" in text
        assert "Kraken Keepers" in text
        assert "src/ui/main.js" in text

        for path in ("/arcade.json", "/assets/cover.jpg", "/assets/icon.jpg", "/src/ui/main.js", "/src/core/game.js"):
            code, payload = fetch(f"http://{HOST}:{PORT}{path}")
            assert code == 200, path
            assert len(payload) > 20, path
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)
    print("smoke ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
