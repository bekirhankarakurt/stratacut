from __future__ import annotations

import io
import os
import socket
import sys
import time
import webbrowser
from multiprocessing import Process, freeze_support
from pathlib import Path

import uvicorn

HEALTH_FAILS_BEFORE_KILL = 4
HEALTH_INTERVAL_S = 1.0


def _redirect_streams_for_noconsole() -> None:
    """When packaged with --noconsole PyInstaller sets sys.stdout/stderr to None.
    Any internal print() or logging call would then raise AttributeError.
    Redirect both to a rotating log file next to the EXE, with a StringIO
    fallback if the file cannot be opened (e.g. read-only install dir).
    """
    if not (getattr(sys, "frozen", False) and sys.stdout is None):
        return
    try:
        log_path = Path(sys.executable).resolve().parent / "pdfsplitter.log"
        log_file = open(log_path, "a", encoding="utf-8", errors="replace")  # noqa: WPS515
    except OSError:
        log_file = io.StringIO()
    sys.stdout = log_file
    sys.stderr = log_file


def _port() -> int:
    return int(os.getenv("PDFSPLITTER_PORT", "8001"))


def health_ok(port: int | None = None, timeout: float = 1.2) -> bool:
    """TCP health check that does not share the HTTP worker's GIL."""
    port = _port() if port is None else port
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(
                b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
            )
            chunks: list[bytes] = []
            while True:
                bit = sock.recv(4096)
                if not bit:
                    break
                chunks.append(bit)
                if sum(len(x) for x in chunks) > 8192:
                    break
        raw = b"".join(chunks)
        idx = raw.find(b"\r\n\r\n")
        head = raw[:idx].lower() if idx >= 0 else raw.lower()
        body = raw[idx + 4 :].lower() if idx >= 0 else b""
        return b" 200 " in head and b'"ok"' in body and b"true" in body
    except OSError:
        return False


def _run_http_worker() -> None:
    _redirect_streams_for_noconsole()
    from backend.app.main import app  # noqa: WPS433

    port = _port()
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level=os.getenv("PDFSPLITTER_LOG_LEVEL", "warning"),
        access_log=False,
        timeout_keep_alive=15,
        timeout_graceful_shutdown=3,
    )
    uvicorn.Server(config).run()


def _already_running() -> bool:
    if sys.platform != "win32":
        return False
    import ctypes

    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW(None, True, "Local\\PDFSplitterProV2Singleton")
    return int(kernel32.GetLastError()) == 183  # ERROR_ALREADY_EXISTS


def _stop_proc(proc: Process) -> None:
    if not proc.is_alive():
        return
    proc.terminate()
    proc.join(timeout=4)
    if proc.is_alive():
        proc.kill()
        proc.join(timeout=3)


def _supervise() -> None:
    port = _port()
    url = f"http://127.0.0.1:{port}/"
    opened = False

    while True:
        proc = Process(target=_run_http_worker, name="pdfsplitter-http")
        proc.start()
        print(f"HTTP worker pid={proc.pid}", flush=True)
        up = False
        for _ in range(40):
            if not proc.is_alive():
                break
            if health_ok(port):
                up = True
                break
            time.sleep(0.25)
        if up and not opened:
            webbrowser.open(url)
            opened = True

        fails = 0
        while proc.is_alive():
            time.sleep(HEALTH_INTERVAL_S)
            if health_ok(port):
                fails = 0
                continue
            fails += 1
            print(f"health miss {fails}/{HEALTH_FAILS_BEFORE_KILL}", flush=True)
            if fails >= HEALTH_FAILS_BEFORE_KILL:
                print("HTTP worker dondu, sonlandırılıp yeniden başlatılacak.", flush=True)
                _stop_proc(proc)
                break

        _stop_proc(proc)
        print("HTTP worker durdu, yeniden başlatılıyor…", flush=True)
        time.sleep(0.7)


def main() -> None:
    _redirect_streams_for_noconsole()
    if _already_running():
        webbrowser.open(f"http://127.0.0.1:{_port()}/")
        return
    _supervise()


if __name__ == "__main__":
    freeze_support()
    main()
