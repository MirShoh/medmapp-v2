"""Tiny closed-loop load tester (stdlib only).

N virtual users each send requests back-to-back (keep-alive) for D seconds, picking paths round-robin.
Reports throughput, latency percentiles and errors per concurrency level.

usage: loadtest.py <base-url> <duration-s> <c1,c2,...> <path> [<path> ...]
       a path starting with "POST:" sends a JSON body: POST:/api/v2/live-chat/|{"text":"hi"}
"""
import http.client
import json
import statistics
import sys
import threading
import time
from urllib.parse import urlparse

base, duration, levels, paths = sys.argv[1], float(sys.argv[2]), [int(x) for x in sys.argv[3].split(",")], sys.argv[4:]
u = urlparse(base)


def worker(results, stop_at, offset):
    conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=30)
    i = offset
    while time.perf_counter() < stop_at:
        p = paths[i % len(paths)]
        i += 1
        method, body, headers = "GET", None, {"Accept-Encoding": "gzip", "User-Agent": "medmapp-loadtest"}
        if p.startswith("POST:"):
            p, raw = p[5:].split("|", 1)
            method, body = "POST", raw.encode()
            headers["Content-Type"] = "application/json"
        t0 = time.perf_counter()
        try:
            conn.request(method, p, body=body, headers=headers)
            r = conn.getresponse()
            r.read()
            status = r.status
            if r.will_close:  # server does not keep the connection alive (Django runserver): open a fresh one
                conn.close()
                conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=30)
        except Exception:
            status = 0
            conn.close()
            conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=30)
        results.append((time.perf_counter() - t0, status))
    conn.close()


for c in levels:
    results = []
    stop_at = time.perf_counter() + duration
    threads = [threading.Thread(target=worker, args=(results, stop_at, k)) for k in range(c)]
    t_start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - t_start
    lat = sorted(x[0] * 1000 for x in results)
    ok = sum(1 for x in results if 200 <= x[1] < 400)
    codes = {}
    for _, s in results:
        codes[s] = codes.get(s, 0) + 1

    def pct(q):
        return round(lat[min(len(lat) - 1, int(q * len(lat)))], 1) if lat else None

    print(json.dumps({"users": c, "requests": len(results), "rps": round(len(results) / elapsed, 1),
                      "ok_pct": round(100 * ok / max(1, len(results)), 1), "p50_ms": pct(0.5), "p95_ms": pct(0.95),
                      "p99_ms": pct(0.99), "mean_ms": round(statistics.mean(lat), 1) if lat else None, "codes": codes}),
          flush=True)
