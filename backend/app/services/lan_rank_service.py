"""Company-LAN player board: UDP beacon + tiny TCP /lan + shared JSON next to EXE.

PDF split API stays on 127.0.0.1. This service only exchanges a small public profile.
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from backend.app.services.save_service import save_file_path

PORT = 18181
MAGIC = "PDFC1"
ONLINE_MS = 25_000
BOARD_NAME = "PDFSplitterPro-lan-ranks.json"
MAX_PLAYERS = 200
MAX_BODY = 65_536

_lock = threading.Lock()
_players: dict[str, dict[str, Any]] = {}
_self: dict[str, Any] = {}
_started = False
_published = False
_udp: socket.socket | None = None
_http: ThreadingHTTPServer | None = None
_stop = threading.Event()
_last_scan = 0.0
_scan_mutex = threading.Lock()

_ALLOWED = {
    "id",
    "name",
    "host",
    "level",
    "xp",
    "achievements",
    "coins",
    "aliveDays",
    "splits",
    "deaths",
    "rank",
    "theme",
    "activity",
    "deadly",
    "minecraftMs",
    "classicMs",
    "mobKills",
    "bossKills",
    "pdfsOpened",
    "pagesSaved",
    "bio",
    "unlocked",
    "hasAvatar",
    "avatarAt",
}

_UDP_KEYS = {k for k in _ALLOWED if k not in ("unlocked",)}
_KEEP = ("bio", "unlocked", "hasAvatar", "avatarAt", "ip")
_MONOTONIC = (
    "xp",
    "level",
    "achievements",
    "coins",
    "aliveDays",
    "splits",
    "deaths",
    "minecraftMs",
    "classicMs",
    "mobKills",
    "bossKills",
    "pdfsOpened",
    "pagesSaved",
    "avatarAt",
)


def _now_ms() -> int:
    return int(time.time() * 1000)


def local_identity() -> dict[str, str]:
    host = socket.gethostname() or "pc"
    user = os.environ.get("USERNAME") or os.environ.get("USER") or "oyuncu"
    pid = f"{host}|{user}".encode("utf-8", errors="replace")
    uid = hashlib.sha256(pid).hexdigest()[:16]
    return {"id": uid, "hostname": host, "username": user}


def board_file_path() -> Path:
    return save_file_path().with_name(BOARD_NAME)


def avatar_file_path() -> Path:
    return save_file_path().with_name("PDFSplitterPro-lan-avatar.jpg")


_avatar_bytes: bytes = b""


def set_local_avatar(data_url: str) -> int:
    global _avatar_bytes
    import base64
    import re

    text = (data_url or "").strip()
    match = re.match(r"^data:image/(?:jpeg|jpg|png);base64,(.+)$", text, re.I | re.S)
    if not match:
        raise ValueError("Geçersiz görsel.")
    raw = base64.b64decode(match.group(1))
    if not raw or len(raw) > 80_000:
        raise ValueError("Görsel çok büyük.")
    _avatar_bytes = raw
    path = avatar_file_path()
    path.write_bytes(raw)
    stamp = _now_ms()
    with _lock:
        if _self:
            _self["hasAvatar"] = True
            _self["avatarAt"] = stamp
            pid = str(_self.get("id") or "")
            if pid:
                _players[pid] = {**_self, "hasAvatar": True, "avatarAt": stamp}
    _broadcast()
    return stamp


def get_local_avatar() -> bytes:
    global _avatar_bytes
    if _avatar_bytes:
        return _avatar_bytes
    path = avatar_file_path()
    if path.is_file():
        _avatar_bytes = path.read_bytes()
        return _avatar_bytes
    return b""


def fetch_peer_avatar(ip: str) -> bytes:
    """Pull another PC's profile JPEG over LAN TCP. Browser never talks to :18181."""
    import ipaddress

    text = (ip or "").strip()
    try:
        addr = ipaddress.ip_address(text)
    except ValueError:
        return b""
    if not (addr.is_private or addr.is_loopback) or addr.is_multicast:
        return b""
    if text in _local_ipv4s() or addr.is_loopback:
        return get_local_avatar()
    try:
        with socket.create_connection((text, PORT), timeout=0.8) as sock:
            sock.sendall(b"GET /lan/avatar HTTP/1.1\r\nHost: lan\r\nConnection: close\r\n\r\n")
            chunks: list[bytes] = []
            while True:
                bit = sock.recv(4096)
                if not bit:
                    break
                chunks.append(bit)
                if sum(len(x) for x in chunks) > 90_000:
                    break
        raw = b"".join(chunks)
        idx = raw.find(b"\r\n\r\n")
        if idx < 0:
            return b""
        header = raw[:idx].split(b"\r\n", 1)[0]
        if b" 200 " not in header and not header.endswith(b" 200"):
            return b""
        body = raw[idx + 4 :]
        return body if body else b""
    except OSError:
        return b""


_peer_avatars: dict[str, tuple[int, bytes]] = {}
_prefetching: set[str] = set()


def get_peer_avatar(ip: str, avatar_at: int = 0) -> bytes:
    """Serve a peer JPEG; refresh when avatarAt changes so other PCs see the new photo."""
    text = (ip or "").strip()
    if not text:
        return b""
    with _lock:
        cached = _peer_avatars.get(text)
    if cached and cached[1] and (avatar_at <= 0 or cached[0] == avatar_at):
        return cached[1]
    raw = fetch_peer_avatar(text)
    if raw:
        with _lock:
            _peer_avatars[text] = (avatar_at or _now_ms(), raw)
        return raw
    return cached[1] if cached and cached[1] else b""


def _prefetch_peer_avatar(ip: str, avatar_at: int) -> None:
    key = f"{ip}:{avatar_at}"
    with _lock:
        if key in _prefetching:
            return
        cached = _peer_avatars.get(ip)
        if cached and cached[0] == avatar_at and cached[1]:
            return
        _prefetching.add(key)
    try:
        get_peer_avatar(ip, avatar_at)
    finally:
        with _lock:
            _prefetching.discard(key)


def clear_local_avatar() -> int:
    global _avatar_bytes
    _avatar_bytes = b""
    path = avatar_file_path()
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
    stamp = _now_ms()
    with _lock:
        if _self:
            _self["hasAvatar"] = False
            _self["avatarAt"] = stamp
            pid = str(_self.get("id") or "")
            if pid and pid in _players:
                _players[pid] = {**_players[pid], **_self}
    _broadcast()
    return stamp


def _sanitize(raw: dict[str, Any], src: str) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    pid = str(raw.get("id") or "")[:32]
    name = str(raw.get("name") or "").strip()[:24]
    if not pid or not name:
        return None
    def _int(key: str, lo: int, hi: int) -> int:
        try:
            n = int(raw.get(key) or 0)
        except (TypeError, ValueError):
            n = 0
        return max(lo, min(hi, n))

    theme = str(raw.get("theme") or "").strip()[:16]
    if theme not in ("minecraft", "classic"):
        theme = ""
    activity = str(raw.get("activity") or "").strip()[:16]
    if activity not in ("idle", "pdf"):
        activity = ""
    deadly = raw.get("deadly") in (True, 1, "1", "true", "True")
    out = {
        "id": pid,
        "name": name,
        "host": str(raw.get("host") or "")[:40],
        "level": _int("level", 1, 9999),
        "xp": _int("xp", 0, 100_000_000),
        "achievements": _int("achievements", 0, 999),
        "coins": _int("coins", 0, 1_000_000),
        "aliveDays": _int("aliveDays", 0, 100_000),
        "splits": _int("splits", 0, 1_000_000),
        "deaths": _int("deaths", 0, 1_000_000),
        "rank": str(raw.get("rank") or "")[:40],
        "theme": theme,
        "activity": activity,
        "deadly": deadly,
        "minecraftMs": _int("minecraftMs", 0, 1_000_000_000_000),
        "classicMs": _int("classicMs", 0, 1_000_000_000_000),
        "mobKills": _int("mobKills", 0, 10_000_000),
        "bossKills": _int("bossKills", 0, 1_000_000),
        "pdfsOpened": _int("pdfsOpened", 0, 1_000_000),
        "pagesSaved": _int("pagesSaved", 0, 10_000_000),
        "src": src,
        "seen": _now_ms(),
    }
    if "bio" in raw:
        out["bio"] = str(raw.get("bio") or "").strip()[:140]
    if "hasAvatar" in raw:
        out["hasAvatar"] = raw.get("hasAvatar") in (True, 1, "1", "true", "True")
    if "avatarAt" in raw:
        out["avatarAt"] = _int("avatarAt", 0, 10_000_000_000_000)
    if "unlocked" in raw:
        unlocked_raw = raw.get("unlocked")
        unlocked: list[str] = []
        if isinstance(unlocked_raw, str):
            unlocked = [x.strip()[:32] for x in unlocked_raw.split(",") if x.strip()]
        elif isinstance(unlocked_raw, list):
            unlocked = [str(x).strip()[:32] for x in unlocked_raw if str(x).strip()]
        out["unlocked"] = unlocked[:250]
        out["achievements"] = max(int(out.get("achievements") or 0), len(out["unlocked"]))
    return out


def _union_ids(a: object, b: object) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for src in (a, b):
        items: list[str] = []
        if isinstance(src, list):
            items = [str(x).strip()[:32] for x in src if str(x).strip()]
        elif isinstance(src, str):
            items = [x.strip()[:32] for x in src.split(",") if x.strip()]
        for item in items:
            if item not in seen:
                seen.add(item)
                out.append(item)
    return out[:250]


def _merge_peer(prev: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    """Keep richer stats when a restart/empty beacon would otherwise wipe the profile."""
    merged = {**prev, **row}
    for key in _MONOTONIC:
        try:
            merged[key] = max(int(prev.get(key) or 0), int(row.get(key) or 0))
        except (TypeError, ValueError):
            merged[key] = prev.get(key, 0)
    unlocked = _union_ids(prev.get("unlocked"), row.get("unlocked"))
    if unlocked:
        merged["unlocked"] = unlocked
        merged["achievements"] = max(int(merged.get("achievements") or 0), len(unlocked))
    if not str(row.get("bio") or "").strip() and prev.get("bio"):
        merged["bio"] = prev["bio"]
    if prev.get("hasAvatar") and not row.get("hasAvatar"):
        prev_at = int(prev.get("avatarAt") or 0)
        new_at = int(row.get("avatarAt") or 0)
        if new_at <= prev_at:
            merged["hasAvatar"] = True
            merged["avatarAt"] = prev_at
    for key in _KEEP:
        if key not in merged and key in prev:
            merged[key] = prev[key]
    merged["seen"] = row.get("seen") or prev.get("seen")
    merged["src"] = row.get("src") or prev.get("src")
    if row.get("ip"):
        merged["ip"] = row["ip"]
    if row.get("name"):
        merged["name"] = row["name"]
    if row.get("theme"):
        merged["theme"] = row["theme"]
    merged["activity"] = row.get("activity") or prev.get("activity") or ""
    return merged


def _upsert(row: dict[str, Any], *, authoritative: bool = False) -> None:
    with _lock:
        prev = _players.get(row["id"])
        if prev and not authoritative:
            row = _merge_peer(prev, row)
        elif prev and authoritative:
            for key in _KEEP:
                if key not in row and key in prev:
                    row[key] = prev[key]
        _players[row["id"]] = row
        if len(_players) > MAX_PLAYERS:
            oldest = sorted(_players.values(), key=lambda p: int(p.get("seen") or 0))
            for drop in oldest[: len(_players) - MAX_PLAYERS]:
                if drop.get("id") != _self.get("id"):
                    _players.pop(str(drop.get("id")), None)


def _load_file() -> None:
    path = board_file_path()
    try:
        if not path.is_file():
            return
        data = json.loads(path.read_text(encoding="utf-8"))
        players = data.get("players") if isinstance(data, dict) else None
        if not isinstance(players, list):
            return
        for item in players:
            row = _sanitize(item if isinstance(item, dict) else {}, "file")
            if row:
                row["seen"] = int(item.get("seen") or row["seen"])
                _upsert(row)
    except Exception:
        return


def _save_file() -> None:
    path = board_file_path()
    with _lock:
        players = list(_players.values())
    blob = json.dumps(
        {"v": 1, "players": [{k: p.get(k) for k in (*_ALLOWED, "seen", "ip")} for p in players]},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(blob, encoding="utf-8")
        tmp.replace(path)
    except OSError:
        return


def _local_ipv4s() -> list[str]:
    found: list[str] = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and ip not in found:
            found.append(ip)
    except OSError:
        pass
    return [ip for ip in found if _private_ip(ip)]


def _private_ip(ip: str) -> bool:
    if ip.startswith("10."):
        return True
    if ip.startswith("192.168."):
        return True
    if ip.startswith("172."):
        try:
            second = int(ip.split(".")[1])
        except (IndexError, ValueError):
            return False
        return 16 <= second <= 31
    return False


def _payload() -> bytes:
    with _lock:
        body = {k: _self.get(k) for k in _UDP_KEYS if k in _self}
    return (MAGIC + json.dumps(body, ensure_ascii=False, separators=(",", ":"))).encode("utf-8")


def ingest(raw: dict[str, Any], src: str) -> None:
    if raw.get("ready") is False:
        pid = str(raw.get("id") or "")[:32]
        if not pid:
            return
        with _lock:
            prev = _players.get(pid)
            if not prev:
                return
            prev["seen"] = _now_ms()
            if ":" in src:
                ip = src.split(":", 1)[1].strip()
                if ip and ip[0].isdigit():
                    prev["ip"] = ip[:40]
        return
    row = _sanitize(raw, src)
    if not row:
        return
    me = local_identity()["id"]
    if row["id"] == me:
        row["src"] = "self"
    if ":" in src:
        ip = src.split(":", 1)[1].strip()
        if ip and ip[0].isdigit():
            row["ip"] = ip[:40]
    with _lock:
        prev = _players.get(row["id"])
        prev_at = int((prev or {}).get("avatarAt") or 0)
    _upsert(row)
    ip = str(row.get("ip") or "")
    new_at = int(row.get("avatarAt") or 0)
    if row.get("id") != me and row.get("hasAvatar") and ip and new_at != prev_at:
        threading.Thread(target=_prefetch_peer_avatar, args=(ip, new_at), daemon=True).start()


def publish(profile: dict[str, Any]) -> dict[str, Any]:
    global _published
    start_lan_rank()
    ident = local_identity()
    merged = {
        **profile,
        "id": ident["id"],
        "host": ident["hostname"],
        "name": str(profile.get("name") or ident["username"])[:24],
    }
    row = _sanitize(merged, "self")
    if not row:
        row = _sanitize({**merged, "name": ident["username"]}, "self")
    if row:
        with _lock:
            _self.clear()
            _self.update(row)
        _published = True
        _upsert(row, authoritative=True)
        _save_file()
        _broadcast()
    return snapshot()


def snapshot() -> dict[str, Any]:
    ident = local_identity()
    now = _now_ms()
    with _lock:
        rows = list(_players.values())
        self_id = str(_self.get("id") or ident["id"])
    rows.sort(key=lambda p: (-int(p.get("level") or 0), -int(p.get("xp") or 0), str(p.get("name") or "")))
    out = []
    for i, p in enumerate(rows, start=1):
        seen = int(p.get("seen") or 0)
        out.append(
            {
                "place": i,
                "id": p.get("id"),
                "name": p.get("name"),
                "host": p.get("host"),
                "level": p.get("level"),
                "xp": p.get("xp"),
                "achievements": max(int(p.get("achievements") or 0), len(p.get("unlocked") or [])),
                "coins": p.get("coins"),
                "aliveDays": p.get("aliveDays"),
                "splits": p.get("splits"),
                "deaths": p.get("deaths"),
                "rank": p.get("rank"),
                "theme": p.get("theme") or "",
                "activity": p.get("activity") or "",
                "deadly": bool(p.get("deadly")),
                "minecraftMs": p.get("minecraftMs") or 0,
                "classicMs": p.get("classicMs") or 0,
                "mobKills": p.get("mobKills") or 0,
                "bossKills": p.get("bossKills") or 0,
                "pdfsOpened": p.get("pdfsOpened") or 0,
                "pagesSaved": p.get("pagesSaved") or 0,
                "bio": p.get("bio") or "",
                "unlocked": p.get("unlocked") or [],
                "hasAvatar": bool(p.get("hasAvatar")),
                "avatarAt": p.get("avatarAt") or 0,
                "ip": p.get("ip") or "",
                "online": (now - seen) <= ONLINE_MS or p.get("id") == self_id,
                "self": p.get("id") == self_id,
            }
        )
    return {
        "selfId": self_id,
        "username": ident["username"],
        "hostname": ident["hostname"],
        "players": out,
    }


def _broadcast() -> None:
    if not _published:
        return
    raw = _payload()
    if not raw or _udp is None:
        return
    targets = {("255.255.255.255", PORT)}
    for ip in _local_ipv4s():
        parts = ip.split(".")
        if len(parts) == 4:
            targets.add((".".join(parts[:3] + ["255"]), PORT))
    for addr in targets:
        try:
            _udp.sendto(raw, addr)
        except OSError:
            pass


def _udp_loop() -> None:
    assert _udp is not None
    while not _stop.is_set():
        try:
            _udp.settimeout(1.0)
            data, addr = _udp.recvfrom(MAX_BODY)
        except TimeoutError:
            continue
        except OSError:
            if _stop.is_set():
                return
            time.sleep(0.4)
            continue
        try:
            text = data.decode("utf-8", errors="ignore")
            if not text.startswith(MAGIC):
                continue
            payload = json.loads(text[len(MAGIC) :])
            if isinstance(payload, dict):
                ingest(payload, f"udp:{addr[0]}")
        except Exception:
            continue


def _beacon_loop() -> None:
    while not _stop.is_set():
        _broadcast()
        _stop.wait(4.0)


class _LanHandler(BaseHTTPRequestHandler):
    def log_message(self, _fmt: str, *_args: object) -> None:  # noqa: D401
        return

    def _send(self, code: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/lan/avatar":
            raw = get_local_avatar()
            if not raw:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
            return
        if path != "/lan":
            self.send_error(404)
            return
        with _lock:
            body = {k: _self.get(k) for k in _ALLOWED if k in _self}
            ready = _published
        body["ready"] = ready
        body["hasAvatar"] = bool(get_local_avatar())
        if not ready:
            self._send(
                200,
                {
                    "id": body.get("id"),
                    "name": body.get("name"),
                    "host": body.get("host"),
                    "ready": False,
                    "hasAvatar": body.get("hasAvatar"),
                },
            )
            return
        self._send(200, body)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/lan":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            n = 0
        if n <= 0 or n > MAX_BODY:
            self._send(400, {"ok": False})
            return
        try:
            payload = json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            self._send(400, {"ok": False})
            return
        if isinstance(payload, dict):
            ingest(payload, f"tcp:{self.client_address[0]}")
        self._send(200, {"ok": True})


def _pull_host(ip: str) -> None:
    try:
        with socket.create_connection((ip, PORT), timeout=0.18) as sock:
            sock.sendall(b"GET /lan HTTP/1.1\r\nHost: lan\r\nConnection: close\r\n\r\n")
            chunks = []
            while True:
                bit = sock.recv(2048)
                if not bit:
                    break
                chunks.append(bit)
                if sum(len(x) for x in chunks) > MAX_BODY + 8_000:
                    break
        raw = b"".join(chunks).decode("utf-8", errors="ignore")
        idx = raw.find("\r\n\r\n")
        body = raw[idx + 4 :] if idx >= 0 else raw
        payload = json.loads(body)
        if isinstance(payload, dict):
            ingest(payload, f"scan:{ip}")
    except Exception:
        return


def scan_lan(force: bool = False) -> None:
    global _last_scan
    now = time.time()
    if not force and now - _last_scan < 8:
        return
    if not _scan_mutex.acquire(blocking=False):
        return
    try:
        _last_scan = time.time()
        hosts: list[str] = []
        mine = set(_local_ipv4s())
        for ip in mine:
            parts = ip.split(".")
            if len(parts) != 4:
                continue
            prefix = ".".join(parts[:3])
            for i in range(1, 255):
                cand = f"{prefix}.{i}"
                if cand not in mine:
                    hosts.append(cand)
        hosts = hosts[:400]
        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(_pull_host, ip) for ip in hosts]
            for fut in as_completed(futs):
                try:
                    fut.result()
                except Exception:
                    pass
        _save_file()
    finally:
        _scan_mutex.release()


def schedule_scan_lan() -> None:
    if time.time() - _last_scan < 8:
        return
    threading.Thread(target=lambda: scan_lan(False), daemon=True, name="lan-scan-once").start()


def _scan_loop() -> None:
    _stop.wait(1.5)
    while not _stop.is_set():
        try:
            scan_lan(force=True)
        except Exception:
            pass
        _stop.wait(90.0)


def start_lan_rank() -> None:
    global _started, _udp, _http, _published
    with _lock:
        if _started:
            return
        _started = True
        _published = False
    _stop.clear()
    ident = local_identity()
    with _lock:
        if not _self:
            _self.update(
                {
                    "id": ident["id"],
                    "name": ident["username"],
                    "host": ident["hostname"],
                    "level": 1,
                    "xp": 0,
                    "achievements": 0,
                    "coins": 0,
                    "aliveDays": 0,
                    "splits": 0,
                    "deaths": 0,
                    "rank": "Yeni Madenci",
                    "theme": "",
                    "activity": "idle",
                    "deadly": False,
                    "minecraftMs": 0,
                    "classicMs": 0,
                    "mobKills": 0,
                    "bossKills": 0,
                    "pdfsOpened": 0,
                    "pagesSaved": 0,
                    "bio": "",
                    "unlocked": [],
                    "hasAvatar": False,
                    "avatarAt": 0,
                    "src": "self",
                    "seen": _now_ms(),
                }
            )
    _load_file()
    with _lock:
        loaded = _players.get(ident["id"])
        if loaded:
            for key in _ALLOWED:
                if key in loaded:
                    _self[key] = loaded[key]
            _self["id"] = ident["id"]
            _self["host"] = ident["hostname"]
            if ident["username"] and not _self.get("name"):
                _self["name"] = ident["username"]
            if int(_self.get("xp") or 0) > 0 or _self.get("unlocked"):
                _published = True
        else:
            _players[ident["id"]] = dict(_self)
        if get_local_avatar():
            _self["hasAvatar"] = True
            pid = ident["id"]
            if pid in _players:
                _players[pid] = {**_players[pid], "hasAvatar": True}
            else:
                _players[pid] = {**_self, "hasAvatar": True}

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("", PORT))
        _udp = sock
        threading.Thread(target=_udp_loop, name="lan-udp", daemon=True).start()
    except OSError:
        sock.close()
        _udp = None

    try:
        http = ThreadingHTTPServer(("0.0.0.0", PORT), _LanHandler)
        http.daemon_threads = True
        _http = http
        threading.Thread(target=http.serve_forever, name="lan-http", daemon=True).start()
    except OSError:
        _http = None

    threading.Thread(target=_beacon_loop, name="lan-beacon", daemon=True).start()
    threading.Thread(target=_scan_loop, name="lan-scan", daemon=True).start()


def stop_lan_rank() -> None:
    global _started, _udp, _http, _published
    _stop.set()
    _published = False
    if _http is not None:
        try:
            _http.shutdown()
        except Exception:
            pass
        _http = None
    if _udp is not None:
        try:
            _udp.close()
        except Exception:
            pass
        _udp = None
    _started = False
