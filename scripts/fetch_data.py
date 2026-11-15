#!/usr/bin/env python3
"""Rebuild docs/data/dashboard.json from public sources. Never invent numbers."""
from __future__ import annotations
import json, math, re, sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "data" / "dashboard.json"
UA = "TCGPulse/1.0 (https://github.com/piyaster11/tcg-pulse; educational dashboard)"
NOW = datetime.now(timezone.utc)

GAMES = [
    {"id": "pokemon", "name": "Pokémon TCG", "short": "Pokémon", "kw": "Pokemon TCG",
     "wiki": "Pokémon_Trading_Card_Game", "color": "#ffcb05", "accent": "#3b4cca"},
    {"id": "onepiece", "name": "One Piece Card Game", "short": "One Piece", "kw": "One Piece Card Game",
     "wiki": "One_Piece_Card_Game", "color": "#e10600", "accent": "#1a1a2e"},
    {"id": "mtg", "name": "Magic: The Gathering", "short": "MTG", "kw": "Magic The Gathering",
     "wiki": "Magic:_The_Gathering", "color": "#f8e7a0", "accent": "#7a1f1f"},
    {"id": "lorcana", "name": "Disney Lorcana", "short": "Lorcana", "kw": "Disney Lorcana",
     "wiki": "Disney_Lorcana", "color": "#c9a227", "accent": "#1e3a5f"},
    {"id": "yugioh", "name": "Yu-Gi-Oh!", "short": "Yu-Gi-Oh!", "kw": "Yu-Gi-Oh",
     "wiki": "Yu-Gi-Oh!", "color": "#7b2cbf", "accent": "#1a0a2e"},
]

MARKET_MOVES = {
    "pokemon": -8, "onepiece": -3, "mtg": 1, "lorcana": -4, "yugioh": 16,
    "source": "GempireCards November 2026 TCG market snapshot, published Nov 14, 2026",
    "url": "https://www.gempirecards.com/news/november-2026-tcg-market-update",
    "window": "past month",
}

POS = set("launch launches launched release released releasing wins won champion championship record surge surges soaring boom booming hit hits hitting strong strength gains gain gained rising rise rose rally celebrate celebrating iconic popular demand sold-out sold out milestone historic success successful exciting hype hyped anniversary".split())
NEG = set("ban banned bans banlist fall falls fell falling drop drops dropped sliding slide decline declines declined crash weak weakness weakens loss losses lose lost delay delayed delays shortage lawsuit scandal controversy controversial nerf nerfed cancel cancelled canceled fraud slump slumps pullback pulled cheaper dump dumping overprint overprinted".split())
JUNK = re.compile(r"youtube|gameplay trailer|tag force|nendoroid|collection with a mostly|disney songs, but|epcot international|how to find it|opening hours and how", re.I)

def log(msg): print(msg, file=sys.stderr, flush=True)

def get(url, headers=None, timeout=25):
    h = {"User-Agent": UA, "Accept": "*/*"}
    if headers: h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def get_json(url, headers=None):
    raw = get(url, headers)
    text = raw.decode("utf-8", "replace")
    if text.startswith(")]}'"):
        text = text.split("\n", 1)[-1]
    return json.loads(text)

def last_n_avg(pts, n):
    vals = [p["v"] for p in (pts or [])[-n:] if isinstance(p.get("v"), (int, float))]
    return sum(vals) / len(vals) if vals else None

def trend_momentum(pts):
    a7, a30 = last_n_avg(pts, 7), last_n_avg(pts, 30)
    latest = pts[-1]["v"] if pts else None
    if a7 is None or not a30:
        return {"score": 50, "a7": a7, "a30": a30, "latest": latest, "note": "insufficient series"}
    ratio = a7 / a30
    score = 50 + 50 * math.tanh((ratio - 1) / 0.4)
    return {"score": round(max(0, min(100, score)), 1), "a7": round(a7, 1), "a30": round(a30, 1),
            "latest": latest, "ratio": round(ratio, 3),
            "note": f"7-day avg {a7:.1f} vs 30-day avg {a30:.1f} (ratio {ratio:.2f})"}

def price_momentum(chg_pct):
    if chg_pct is None:
        return {"score": None, "note": "no monthly index"}
    score = 50 + 50 * math.tanh(chg_pct / 20.0)
    return {"score": round(max(0, min(100, score)), 1), "chg": chg_pct,
            "note": f"monthly category move {chg_pct:+.0f}% (GempireCards)"}

def tokenize(t): return re.findall(r"[a-z0-9']+", t.lower())

def sentiment_of(titles):
    if not titles:
        return {"score": 50, "n": 0, "pos": 0, "neg": 0, "hits": 0,
                "method": "simple headline lexicon (pos/neg word counts, shrunk toward 50)", "sample": []}
    pos = neg = 0
    for t in titles:
        toks = tokenize(t)
        pos += sum(1 for w in toks if w in POS)
        neg += sum(1 for w in toks if w in NEG)
    hits = pos + neg
    raw = 50 if hits == 0 else 50 + 50 * (pos - neg) / hits
    score = (raw * hits + 50 * 4) / (hits + 4)
    return {"score": round(score, 1), "n": len(titles), "pos": pos, "neg": neg, "hits": hits,
            "method": "simple headline lexicon (pos/neg word counts, shrunk toward 50)", "sample": titles[:8]}

def band(score):
    if score <= 24: return "Extreme Fear", "#ff4d4d"
    if score <= 44: return "Fear", "#ff6a1c"
    if score <= 55: return "Neutral", "#ffcf33"
    if score <= 75: return "Greed", "#c6e01a"
    return "Extreme Greed", "#19e07a"

def parse_time(s):
    if not s: return None
    try: d = parsedate_to_datetime(s.strip())
    except Exception:
        try: d = datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
        except Exception: return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)

def fetch_wiki():
    wiki = {"source": "Wikimedia Pageviews API (en.wikipedia, all-access, user)", "status": "fail", "series": {}, "note": ""}
    end = NOW.strftime("%Y%m%d")
    start = (NOW - timedelta(days=90)).strftime("%Y%m%d")
    try:
        for g in GAMES:
            url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
                   f"en.wikipedia/all-access/user/{urllib.parse.quote(g['wiki'], safe='')}/daily/{start}/{end}")
            data = get_json(url)
            pts = []
            for it in data.get("items") or []:
                ts = str(it.get("timestamp", ""))[:8]
                pts.append({"d": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}", "v": int(it.get("views") or 0)})
            wiki["series"][g["id"]] = pts
            log(f"wiki {g['id']}: {len(pts)} days")
        wiki["status"] = "ok"
        wiki["note"] = "Daily English Wikipedia article views, past 90 days. Traffic proxy, not Google Trends."
    except Exception as e:
        log(f"wiki fail: {e}")
        wiki["note"] = f"Pageviews fetch failed: {e}"
    return wiki

def fetch_trends():
    """One combined 5-keyword request. Warm up cookies first; a bare API call often 429s."""
    import http.cookiejar
    trends = {"source": None, "status": "fail", "timeframe": "today 3-m", "geo": "Worldwide",
              "series": {}, "related": {}, "note": ""}
    kws = [g["kw"] for g in GAMES]
    req = {"comparisonItem": [{"keyword": k, "geo": "", "time": "today 3-m"} for k in kws],
           "category": 0, "property": ""}
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    last_err = None
    for attempt in range(3):
        try:
            if attempt:
                import time as _t; _t.sleep(20 * attempt)
                log(f"trends retry {attempt+1}/3")
            reqh = urllib.request.Request("https://trends.google.com/trends/",
                                          headers={"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"})
            opener.open(reqh, timeout=25).read()
            url = "https://trends.google.com/trends/api/explore?" + urllib.parse.urlencode({
                "hl": "en-US", "tz": "-420", "req": json.dumps(req, separators=(",", ":"))
            })
            raw = opener.open(urllib.request.Request(url, headers={
                "User-Agent": ua, "Accept": "application/json", "Referer": "https://trends.google.com/trends/explore",
                "Accept-Language": "en-US,en;q=0.9"}), timeout=25).read()
            text = raw.decode("utf-8", "replace")
            if text.startswith(")]}'"): text = text.split("\n", 1)[-1]
            data = json.loads(text)
            widget = next((w for w in data.get("widgets", []) if w.get("token") and (
                "TIMESERIES" in str(w.get("id", "")).upper() or w.get("type") == "fe_line_chart")), None)
            if not widget:
                widget = next((w for w in data.get("widgets", []) if w.get("token")), None)
            if not widget:
                raise RuntimeError("no widget")
            wurl = "https://trends.google.com/trends/api/widgetdata/multiline?" + urllib.parse.urlencode({
                "hl": "en-US", "tz": "-420",
                "req": json.dumps(widget["request"], separators=(",", ":")),
                "token": widget["token"],
            })
            raw2 = opener.open(urllib.request.Request(wurl, headers={
                "User-Agent": ua, "Accept": "application/json", "Referer": "https://trends.google.com/trends/explore",
            }), timeout=25).read()
            t2 = raw2.decode("utf-8", "replace")
            if t2.startswith(")]}'"): t2 = t2.split("\n", 1)[-1]
            wdata = json.loads(t2)
            timeline = (wdata.get("default") or {}).get("timelineData") or []
            series = {g["id"]: [] for g in GAMES}
            for row in timeline:
                ts = int(row.get("time") or 0)
                d = datetime.fromtimestamp(ts, timezone.utc).date().isoformat() if ts else str(row.get("formattedTime", ""))[:10]
                vals = row.get("value") or []
                for i, g in enumerate(GAMES):
                    v = vals[i] if i < len(vals) else 0
                    series[g["id"]].append({"d": d, "v": int(v) if v is not None else 0})
            if not any(series.values()):
                raise RuntimeError("empty series")
            trends.update(source="Google Trends (public widget API)", status="ok", series=series,
                          fetchedAt=NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
                          note="Worldwide interest over time, past 90 days, relative 0–100 across the five queries (not absolute search volume).")
            log("trends OK")
            return trends
        except Exception as e:
            last_err = e
            log(f"trends fail attempt {attempt+1}: {type(e).__name__}: {e}")
    trends["note"] = f"Google Trends blocked ({type(last_err).__name__ if last_err else 'unknown'}). Wikipedia pageviews used as a labeled proxy."
    return trends

def fetch_news():
    items, status = [], {}
    for name, gid, url in FEEDS:
        try:
            raw = get(url, {"Accept": "application/rss+xml,application/xml,text/xml,*/*",
                            "User-Agent": "Mozilla/5.0"})
            root = ET.fromstring(raw)
            n = 0
            for it in root.iter():
                tagn = it.tag.split("}")[-1]
                if tagn not in ("item", "entry"): continue
                g = lambda n, it=it: next((c for c in it if c.tag.split("}")[-1] == n), None)
                title = (g("title").text or "").strip() if g("title") is not None else ""
                ln = g("link"); link = (ln.text or ln.get("href") or "").strip() if ln is not None else ""
                tm = next((g(n).text for n in ("pubDate", "published", "updated", "date") if g(n) is not None), None)
                src = name
                if "news.google.com" in url and " - " in title:
                    title, src = title.rsplit(" - ", 1)
                    title, src = title.strip(), src.strip()
                d = parse_time(tm) or NOW
                if title and link:
                    items.append({"title": re.sub(r"\s+", " ", title), "source": src, "link": link,
                                  "utc": d.strftime("%Y-%m-%dT%H:%M:%SZ"), "game": gid, "highlight": False, "_d": d})
                    n += 1
            status[name] = f"ok ({n})"
            log(f"feed {name}: {n}")
        except Exception as e:
            status[name] = "fail: " + str(e)[:80]
            log(f"feed {name} FAIL: {e}")
    for c in CURATED_NEWS:
        d = datetime.fromisoformat(c["utc"].replace("Z", "+00:00"))
        items.append({**c, "_d": d})
    seen, cleaned = set(), []
    for it in sorted(items, key=lambda x: (not x.get("highlight"), -x["_d"].timestamp())):
        if it["_d"] > NOW + timedelta(hours=2): continue
        if JUNK.search(it["title"]): continue
        key = re.sub(r"[^a-z0-9]", "", it["title"].lower())[:70]
        if key in seen: continue
        seen.add(key)
        rec = {k: it[k] for k in ("title", "source", "link", "utc", "game") if k in it}
        rec["highlight"] = bool(it.get("highlight"))
        rec["breaking"] = (NOW - it["_d"]).total_seconds() < 6 * 3600
        cleaned.append(rec)
    by, high, final, seen2 = defaultdict(list), [], [], set()
    for it in cleaned:
        (high if it["highlight"] else by[it["game"]]).append(it)
    def add(it):
        k = re.sub(r"[^a-z0-9]", "", it["title"].lower())[:70]
        if k in seen2: return
        seen2.add(k); final.append(it)
    for it in high: add(it)
    for g in GAMES:
        for it in by[g["id"]][:6]: add(it)
    for it in cleaned:
        if len(final) >= 36: break
        add(it)
    return {"updated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "feeds": status, "items": final}

def fetch_scryfall():
    prices = {"status": "partial", "items": {}, "notes": []}
    try:
        sets = get_json("https://api.scryfall.com/sets", {"User-Agent": UA})
        trek = [s for s in sets.get("data", []) if "star trek" in (s.get("name") or "").lower()]
        prices["mtg_sets"] = [{"code": s.get("code"), "name": s.get("name"),
                               "released": s.get("released_at"), "count": s.get("card_count")} for s in trek[:8]]
        main = next((s for s in trek if s.get("code") == "trk"), trek[0] if trek else None)
        if main:
            code = main["code"]
            search = get_json(
                f"https://api.scryfall.com/cards/search?q={urllib.parse.quote('set:'+code+' usd>1')}&order=usd&dir=desc",
                {"User-Agent": UA})
            top = []
            for c in (search.get("data") or [])[:8]:
                p = c.get("prices") or {}
                top.append({"name": c.get("name"), "set": c.get("set_name"), "rarity": c.get("rarity"),
                            "usd": p.get("usd") or p.get("usd_foil") or p.get("usd_etched"),
                            "usd_foil": p.get("usd_foil"),
                            "url": c.get("scryfall_uri") or c.get("uri"),
                            "collector": c.get("collector_number")})
            prices["items"]["mtg"] = {"source": "Scryfall prices (TCGPlayer market when available)",
                                      "asof": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                      "set": main.get("name"), "code": code, "top": top}
            log(f"scryfall top: {[(t['name'], t['usd']) for t in top[:5]]}")
    except Exception as e:
        log(f"scryfall fail: {e}")
        prices["notes"].append(f"Scryfall: {e}")
    return prices

def news_volume_score(gid, items):
    cutoff = NOW - timedelta(days=14)
    counts = defaultdict(int)
    for it in items:
        d = datetime.fromisoformat(it["utc"].replace("Z", "+00:00"))
        if d >= cutoff:
            counts[it["game"]] += 1
    n = counts.get(gid, 0)
    vals = [counts[g["id"]] for g in GAMES]
    avg = sum(vals) / len(vals) if vals else 1
    if avg == 0:
        return {"score": 50, "n": n, "note": "no recent headlines"}
    ratio = n / avg
    score = 50 + 50 * math.tanh((ratio - 1) / 0.8)
    return {"score": round(max(0, min(100, score)), 1), "n": n, "avg": round(avg, 1),
            "note": f"{n} headlines in 14d vs {avg:.1f} game average"}



def translate_snkrdunk_title(title):
    """Map common SNKRDUNK TCG headline phrases into English (longest match first).
    Leftover CJK is stripped of particles/punctuation; anything still untranslated
    is left in place and logged so we never invent a gloss.
    """
    if not title:
        return title
    months = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
              7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}
    s = title
    s = re.sub(
        r"【(\d{1,2})/(\d{1,2})更新】",
        lambda m: " (updated %d %s)" % (int(m.group(2)), months.get(int(m.group(1)), m.group(1))),
        s,
    )
    pairs = [
        ("30th CELEBRATION(30th セレブレーション)", "30th Celebration"),
        ("30th CELEBRATION", "30th Celebration"),
        ("30th セレブレーション", "30th Celebration"),
        ("スペシャルデッキセットMEGA", "MEGA special deck set "),
        ("スペシャルデッキセット", "special deck set "),
        ("メガオーダイル", "Mega Feraligatr"),
        ("メガカイリュー", "Mega Dragonite"),
        ("メガゲンガー", "Mega Gengar"),
        ("ハドウシーカー", "Hadow Seeker"),
        ("ストームエメラルダ", "Storm Emeralda"),
        ("神の支配", "The Dominance of God"),
        ("予約・抽選情報まとめ", "pre-order and lottery roundup"),
        ("相場情報と収録カード一覧", "market prices and card list"),
        ("当たりランキング", "hit ranking"),
        ("買取・相場価格と値段推移", "buyback and market-price history"),
        ("買取相場", "buyback prices"),
        ("封入率", "pull rates"),
        ("予約抽選", "pre-orders and lottery"),
        ("値段まとめ", "price guide"),
        ("の再販はいつ？", ": when is the reprint? "),
        ("再販入荷情報まとめ", "restock roundup"),
        ("当たりカードの初動相場を一挙紹介！", "opening hit-card prices"),
        ("当たりカードの初動相場を一挙紹介", "opening hit-card prices"),
        ("当たりカード情報", "hit-card guide"),
        ("本日発売！「IMMORTAL PHOENIX」", "Immortal Phoenix launches today — "),
        ("本日発売！", "launches today — "),
        ("【ポケカ30周年】", "Pokémon TCG 30th Anniversary: "),
        ("【ポケカ新弾】", "Pokémon TCG: "),
        ("【ポケカ】", "Pokémon TCG: "),
        ("【ワンピースカード】", "One Piece Card Game: "),
        ("【ワンピ新弾】", "One Piece Card Game: "),
        ("【遊戯王OCG】", "Yu-Gi-Oh! OCG: "),
        ("【遊戯王】", "Yu-Gi-Oh!: "),
        ("ポケカ", "Pokémon TCG"),
        ("遊戯王OCG", "Yu-Gi-Oh! OCG"),
        ("遊戯王", "Yu-Gi-Oh!"),
        ("ワンピースカード", "One Piece Card Game"),
        ("ミュウ", "Mew"),
    ]
    pairs.sort(key=lambda x: len(x[0]), reverse=True)
    for jp, en in pairs:
        s = s.replace(jp, en)
    # particles / punctuation left between English chunks
    s = s.replace("「", '"').replace("」", '"').replace("『", '"').replace("』", '"')
    s = s.replace("・", ", ").replace("、", ", ").replace("。", ". ")
    s = s.replace("！", "! ").replace("？", "? ").replace("｜", " — ").replace("〜", "–")
    for p in ("を", "に", "は", "が", "と", "で", "も", "へ", "から", "まで", "より", "の"):
        s = s.replace(p, " ")
    # slashes as list commas, but keep short codes like R/RGB
    s = re.sub(r"(?<=[a-z)])/(?=[A-Za-z])", ", ", s)
    s = re.sub(r"\s+([,.:;!?])", r"\1", s)
    s = re.sub(r"(?<!\s)(\()", r" \1", s)
    s = re.sub(r"([!?])(?=[A-Za-z\"])", r"\1 ", s)
    s = re.sub(r"\s+—\s+", " — ", s)
    s = re.sub(r'([A-Za-z0-9!?.])"(?=[A-Za-z])', r'\1" ', s)
    s = re.sub(r"\s{2,}", " ", s)
    s = s.strip(" ・/-–")
    s = re.sub(r"\s{2,}", " ", s).strip()
    s = s.replace(" : ", ": ")
    return s


def fetch_snkrdunk():
    """Pull TCG editorial articles from the SNKRDUNK homepage (articles URL redirects here)."""
    import re
    from html import unescape
    items, status = [], "fail"
    try:
        raw = get("https://snkrdunk.com/", {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                                            "Accept-Language": "ja,en;q=0.8"})
        text = raw.decode("utf-8", "replace")
        TCG = re.compile(r"ポケカ|ポケモン|遊戯王|ワンピ|ONE PIECE|One Piece|ワンピースカード|ロルカナ|Lorcana|マジック|MTG|トレカ|デュエル")
        GAME_RX = [
            ("pokemon", re.compile(r"ポケカ|ポケモン")),
            ("onepiece", re.compile(r"ワンピ|ONE PIECE|One Piece|ワンピース")),
            ("yugioh", re.compile(r"遊戯王|デュエル")),
            ("lorcana", re.compile(r"ロルカナ|Lorcana")),
            ("mtg", re.compile(r"マジック|MTG|Magic:? The Gathering")),
        ]
        pat = re.compile(r'\\?"href\\?":\\?"/articles/(\d+)\\?"([\s\S]{0,2500}?)(?=\\?"href\\?":\\?"/articles/|\Z)')
        seen = set()
        for m in pat.finditer(text):
            aid, blob = m.group(1), m.group(2)
            titles = []
            for tm in re.finditer(r"_1Dxq6G_title\\?\"\s*,\s*\\?\"children\\?\":\\?\"([^\"]+)\"", blob):
                titles.append(tm.group(1))
            for tm in re.finditer(r"\\?\"alt\\?\":\\?\"([^\"]+)\"", blob):
                titles.append(tm.group(1))
            dates = []
            for dm in re.finditer(r"_1Dxq6G_publishedAt[\s\S]{0,80}?children\\?\":\s*\[\s*\\?\"([^\"]+年[^\"]+日)\\?\"", blob):
                dates.append(dm.group(1))
            clean = []
            for s in titles:
                s = unescape(s)
                s = re.split(r'"\s*,\s*"width"|"}],', s)[0].strip().rstrip("\\")
                if 8 <= len(s) <= 160 and "className" not in s and not s.startswith("http"):
                    clean.append(s)
            if not clean:
                continue
            title = min(clean, key=len)
            if not TCG.search(title) or aid in seen:
                continue
            seen.add(aid)
            gid = "pokemon"
            for g, rx in GAME_RX:
                if rx.search(title):
                    gid = g
                    break
            utc = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
            if dates:
                dm = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", dates[0])
                if dm:
                    y, mo, d = int(dm.group(1)), int(dm.group(2)), int(dm.group(3))
                    # noon JST = 03:00 UTC
                    utc = f"{y:04d}-{mo:02d}-{d:02d}T03:00:00Z"
            en = translate_snkrdunk_title(title)
            if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", en):
                log(f"SNKRDUNK untranslated leftover: {en}")
            items.append({"title": en, "source": "SNKRDUNK (JP)",
                          "link": f"https://snkrdunk.com/articles/{aid}/",
                          "utc": utc, "game": gid, "highlight": True, "breaking": False})
        status = f"ok ({len(items)})"
        log(f"SNKRDUNK {status}")
    except Exception as e:
        status = "fail: " + str(e)[:80]
        log(f"SNKRDUNK FAIL: {e}")
    return items, status

def main():
    prev = json.loads(OUT.read_text()) if OUT.exists() else {}
    trends = fetch_trends()
    wiki = fetch_wiki()
    if wiki["status"] != "ok" and prev.get("wiki", {}).get("series"):
        wiki = prev["wiki"]
        log("kept previous wiki series")
    news = fetch_news()
    sndk_items, sndk_status = fetch_snkrdunk()
    news.setdefault("feeds", {})["SNKRDUNK (JP)"] = sndk_status
    if sndk_items:
        # drop stale SNKRDUNK copies then prepend
        others = [x for x in news.get("items") or [] if not str(x.get("source") or "").startswith("SNKRDUNK")]
        news["items"] = sndk_items + others
    prices = fetch_scryfall()
    # keep curated dated prices / trending from previous snapshot if present
    if prev.get("prices", {}).get("curated"):
        prices["curated"] = prev["prices"]["curated"]
    prices.setdefault("notes", [])
    sent = {}
    for g in GAMES:
        titles = [x["title"] for x in news["items"] if x["game"] == g["id"]][:18]
        sent[g["id"]] = sentiment_of(titles)

    use_series = trends["series"] if trends["status"] == "ok" else wiki["series"]
    series_label = trends["source"] if trends["status"] == "ok" else wiki.get("source")
    fg_games = {}
    for g in GAMES:
        gid = g["id"]
        tm = trend_momentum(use_series.get(gid) or [])
        sm = sent[gid]
        nv = news_volume_score(gid, news["items"])
        pm = price_momentum(MARKET_MOVES.get(gid))
        comps = [
            {"id": "trend", "name": "Trend momentum", "score": tm["score"], "detail": tm["note"], "weight": 0.30, "src": series_label},
            {"id": "sentiment", "name": "Headline sentiment", "score": sm["score"],
             "detail": f"{sm['pos']} pos / {sm['neg']} neg words in {sm['n']} headlines", "weight": 0.25,
             "src": "lexicon on RSS + curated headlines"},
            {"id": "volume", "name": "News volume", "score": nv["score"], "detail": nv["note"], "weight": 0.20,
             "src": "Google News RSS + official feeds, 14 days"},
            {"id": "price", "name": "Price momentum", "score": pm["score"] if pm["score"] is not None else 50,
             "detail": pm["note"], "weight": 0.25, "src": MARKET_MOVES["source"], "missing": pm["score"] is None},
        ]
        score = round(sum(c["score"] * c["weight"] for c in comps), 1)
        fg_games[gid] = {"score": score, "components": comps, "trend": tm, "sentiment": sm, "volume": nv, "price": pm}
    overall = round(sum(fg_games[g["id"]]["score"] for g in GAMES) / 5, 1)

    payload = {
        "asOf": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "asOfIct": (NOW + timedelta(hours=7)).strftime("%Y-%m-%d %H:%M ICT"),
        "games": GAMES,
        "trends": trends,
        "wiki": wiki,
        "seriesUsed": series_label,
        "news": news,
        "sentiment": sent,
        "prices": prices,
        "marketMoves": MARKET_MOVES,
        "trending": prev.get("trending") or {},
        "fearGreed": {
            "overall": overall,
            "overallBand": band(overall)[0],
            "overallColor": band(overall)[1],
            "games": {gid: {**fg, "band": band(fg["score"])[0], "color": band(fg["score"])[1]} for gid, fg in fg_games.items()},
            "method": "Equal-weight average of five game scores. Each game score is a weighted mix of trend momentum (30%), headline sentiment (25%), 14-day news volume (20%), and monthly category price momentum (25%). Trend uses Google Trends when available, otherwise Wikipedia pageviews (labeled). Scores are computed, never invented.",
            "bands": [[24, "Extreme Fear", "#ff4d4d"], [44, "Fear", "#ff6a1c"], [55, "Neutral", "#ffcf33"],
                      [75, "Greed", "#c6e01a"], [100, "Extreme Greed", "#19e07a"]],
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    log(f"wrote {OUT}")
    log(f"OVERALL FG={overall} {band(overall)[0]}")
    for g in GAMES:
        fg = fg_games[g["id"]]
        log(f"  {g['id']}: {fg['score']} {band(fg['score'])[0]}")

if __name__ == "__main__":
    main()
