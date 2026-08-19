#!/usr/bin/env python3
"""YKS soru defteri: ortak SQLite + statik dosyalar."""

from __future__ import annotations

import json
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "yks.db"
PORT = 5173


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS logs (
            date TEXT PRIMARY KEY,
            notes TEXT NOT NULL DEFAULT '',
            counts TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    return conn


def row_to_log(row: sqlite3.Row) -> dict:
    return {
        "date": row["date"],
        "notes": row["notes"],
        "counts": json.loads(row["counts"]),
        "updatedAt": row["updated_at"],
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        if self.path.startswith("/api/"):
            super().log_message(format, *args)

    def send_json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/logs":
            date = parse_qs(parsed.query).get("date", [None])[0]
            with connect() as conn:
                if date:
                    row = conn.execute(
                        "SELECT * FROM logs WHERE date = ?", (date,)
                    ).fetchone()
                    self.send_json(row_to_log(row) if row else None)
                    return
                rows = conn.execute(
                    "SELECT * FROM logs ORDER BY date ASC"
                ).fetchall()
                self.send_json([row_to_log(row) for row in rows])
            return
        super().do_GET()

    def do_PUT(self) -> None:
        if urlparse(self.path).path != "/api/logs":
            self.send_error(404)
            return
        data = self.read_json()
        date = data.get("date")
        if not date:
            self.send_json({"error": "date gerekli"}, 400)
            return
        notes = data.get("notes") or ""
        counts = json.dumps(data.get("counts") or {}, ensure_ascii=False)
        updated_at = int(data.get("updatedAt") or 0)
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO logs (date, notes, counts, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    notes = excluded.notes,
                    counts = excluded.counts,
                    updated_at = excluded.updated_at
                """,
                (date, notes, counts, updated_at),
            )
        self.send_json({"ok": True})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/logs":
            self.send_error(404)
            return
        date = parse_qs(parsed.query).get("date", [None])[0]
        if not date:
            self.send_json({"error": "date gerekli"}, 400)
            return
        with connect() as conn:
            conn.execute("DELETE FROM logs WHERE date = ?", (date,))
        self.send_json({"ok": True})


def main() -> None:
    connect().close()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"YKS soru defteri: http://127.0.0.1:{PORT}")
    print(f"Ortak veritabanı: {DB_PATH}")
    print("Chrome, Safari, Firefox aynı adresi açınca aynı kayıtları görür.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDurduruldu.")


if __name__ == "__main__":
    main()
