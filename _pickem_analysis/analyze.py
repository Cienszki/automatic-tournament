# -*- coding: utf-8 -*-
import csv, json, statistics
from collections import defaultdict

BUCKET_POINTS = {
    "place_1": 16,
    "place_2": 15,
    "place_3_4": 13,
    "place_5_8": 9,
    "place_9_12": 5,
}
# representative seed (average finishing rank) for each bucket, for "predicted placement"
BUCKET_SEED = {
    "place_1": 1.0,
    "place_2": 2.0,
    "place_3_4": 3.5,
    "place_5_8": 6.5,
    "place_9_12": 10.5,
}
BUCKET_LABEL = {
    "place_1": "1st",
    "place_2": "2nd",
    "place_3_4": "3rd–4th",
    "place_5_8": "5th–8th",
    "place_9_12": "9th–12th",
}

rows = []
with open("pickem.csv", encoding="utf-8") as f:
    r = csv.DictReader(f)
    for row in r:
        rows.append(row)

# --- actual results ---
actual_bucket = {}   # teamName -> bucketId
actual_points = {}   # teamName -> points
team_id_by_name = {}
for row in rows:
    if row["userId"] == "ACTUAL":
        actual_bucket[row["teamName"]] = row["bucketId"]
        actual_points[row["teamName"]] = BUCKET_POINTS[row["bucketId"]]
        team_id_by_name[row["teamName"]] = row["teamId"]

# --- predictions ---
preds = [row for row in rows if row["userId"] != "ACTUAL"]

players = {}  # userId -> {name, discord, picks:[{team,bucket,pred_pts}]}
for row in preds:
    uid = row["userId"]
    if uid not in players:
        players[uid] = {
            "userId": uid,
            "name": row["displayName"],
            "discord": row["discordUsername"],
            "picks": [],
        }
    players[uid]["picks"].append({
        "team": row["teamName"],
        "bucket": row["bucketId"],
        "pred_pts": BUCKET_POINTS[row["bucketId"]],
    })

def act_pts(team):
    return actual_points.get(team, 0)  # teams outside top12 -> 0

# --- PLAYER SCORING: sum of |predicted - actual| over their picks ---
player_scores = []
for uid, p in players.items():
    total_abs = 0
    exact_bucket_hits = 0
    picks_of_scoring_teams = 0
    champ_pick = None
    for pk in p["picks"]:
        a = act_pts(pk["team"])
        total_abs += abs(pk["pred_pts"] - a)
        if pk["bucket"] == "place_1":
            champ_pick = pk["team"]
        if pk["team"] in actual_bucket and pk["bucket"] == actual_bucket[pk["team"]]:
            exact_bucket_hits += 1
        if pk["team"] in actual_bucket:
            picks_of_scoring_teams += 1
    player_scores.append({
        "userId": uid,
        "name": p["name"],
        "discord": p["discord"],
        "num_picks": len(p["picks"]),
        "total_abs_diff": total_abs,
        "exact_bucket_hits": exact_bucket_hits,
        "hit_top12": picks_of_scoring_teams,     # how many of their picks actually made top 12
        "champ_pick": champ_pick,
        "champ_correct": champ_pick == "Gang sylwka",
    })

player_scores.sort(key=lambda x: (x["total_abs_diff"], -x["exact_bucket_hits"]))

# --- TEAM STATS ---
team_stats = {}
all_teams = set(t for p in players.values() for pk in p["picks"] for t in [pk["team"]])
all_teams |= set(actual_bucket.keys())
for team in all_teams:
    picks_for = [pk for p in players.values() for pk in p["picks"] if pk["team"] == team]
    pred_points = [pk["pred_pts"] for pk in picks_for]
    pred_seeds = [BUCKET_SEED[pk["bucket"]] for pk in picks_for]
    champ_votes = sum(1 for pk in picks_for if pk["bucket"] == "place_1")
    a = act_pts(team)
    in_top12 = team in actual_bucket
    exact_hits = sum(1 for pk in picks_for if in_top12 and pk["bucket"] == actual_bucket[team])
    team_stats[team] = {
        "team": team,
        "pick_count": len(picks_for),
        "pick_pct": round(100 * len(picks_for) / len(players), 1),
        "avg_pred_pts": round(statistics.mean(pred_points), 2) if pred_points else 0,
        "avg_pred_seed": round(statistics.mean(pred_seeds), 2) if pred_seeds else None,
        "seed_stdev": round(statistics.pstdev(pred_seeds), 2) if len(pred_seeds) > 1 else 0,
        "champ_votes": champ_votes,
        "actual_bucket": actual_bucket.get(team),
        "actual_label": BUCKET_LABEL.get(actual_bucket.get(team), "Missed top-12"),
        "actual_pts": a,
        "in_top12": in_top12,
        "avg_error": round(statistics.mean([abs(pk["pred_pts"] - a) for pk in picks_for]), 2) if picks_for else None,
        "overrating": round((statistics.mean(pred_points) - a), 2) if pred_points else None,  # +overrated / -underrated
        "exact_hits": exact_hits,
    }

result = {
    "num_players": len(players),
    "num_teams_predicted": len(all_teams),
    "buckets": BUCKET_POINTS,
    "actual_results": [
        {"team": t, "bucket": actual_bucket[t], "label": BUCKET_LABEL[actual_bucket[t]], "pts": actual_points[t]}
        for t in sorted(actual_bucket, key=lambda t: -actual_points[t])
    ],
    "player_scores": player_scores,
    "team_stats": sorted(team_stats.values(), key=lambda x: -x["pick_count"]),
}

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# --- console summary ---
print("PLAYERS:", len(players), " TEAMS PREDICTED:", len(all_teams))
print("\n=== PLAYER LEADERBOARD (lowest total |pred-actual| = best) ===")
maxpossible = None
for i, ps in enumerate(player_scores, 1):
    print(f"{i:2}. {ps['name']:<22} diff={ps['total_abs_diff']:>3}  exact_bucket={ps['exact_bucket_hits']}  top12_hits={ps['hit_top12']}/12  champ={'Y' if ps['champ_correct'] else 'n'}({ps['champ_pick']})")

print("\n=== ACTUAL FINAL BRACKET ===")
for a in result["actual_results"]:
    print(f"  {a['label']:<9} {a['pts']:>2} pts  {a['team']}")

print("\n=== TEAM STATS (by popularity) ===")
for t in result["team_stats"]:
    print(f"  {t['team']:<26} picks={t['pick_count']:>2} ({t['pick_pct']:>4}%)  champ_votes={t['champ_votes']:>2}  avgPredPts={t['avg_pred_pts']:>5}  actual={t['actual_pts']:>2} ({t['actual_label']})  overrating={t['overrating']}")
