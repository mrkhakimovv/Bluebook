#!/usr/bin/env python3
"""
Bluebook Digital SAT — Rasch (1PL IRT) Joint Maximum Likelihood (JML) Kalibrlash Skripti
Faqat Python standart kutubxonasi (va mavjud bo'lsa numpy) ishlatiladi.
"""

import argparse
import csv
import json
import math
import random
import sys
import time
from typing import Dict, List, Any, Tuple


def prob_correct(theta: float, b: float) -> float:
    z = theta - b
    if z > 30.0:
        return 1.0 - 1e-13
    if z < -30.0:
        return 1e-13
    return 1.0 / (1.0 + math.exp(-z))


def estimate_single_person_theta(
    responses: List[float],
    item_b: List[float],
    extreme_adjust: float = 0.3,
    max_iter: int = 50,
    tol: float = 1e-6,
) -> float:
    """Estimate theta for a single person given fixed item difficulties b."""
    n = len(responses)
    if n == 0:
        return 0.0
    r_raw = sum(responses)
    r = r_raw
    if r_raw <= 0.0:
        r = extreme_adjust
    elif r_raw >= float(n):
        r = float(n) - extreme_adjust

    mean_b = sum(item_b) / float(n)
    theta = max(-6.0, min(6.0, mean_b + math.log(r / (float(n) - r))))

    for _ in range(max_iter):
        sum_p = 0.0
        info = 0.0
        for b_val in item_b:
            p = prob_correct(theta, b_val)
            sum_p += p
            info += p * (1.0 - p)
        if info < 1e-9:
            break
        grad = r - sum_p
        step = max(-1.0, min(1.0, grad / info))
        theta = max(-6.0, min(6.0, theta + step))
        if abs(step) < tol:
            break

    return theta


def calibrate_section(
    section_name: str,
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Calibrate a single section ('rw' or 'math') using two-stage JML:
    Stage 1: Scored items (scored == 1) via Joint Maximum Likelihood with missing-data mask,
             extreme person/item filtering, step clamping <= 1 logit, mean-0 centering,
             and (L-1)/L JML bias correction.
    Stage 2: Pretest items (scored == 0) via fixed-theta MLE anchored on Stage 1 person thetas.
    """
    if not rows:
        return []

    session_ids = sorted({r["sessionId"] for r in rows})
    session_idx_map = {sid: i for i, sid in enumerate(session_ids)}
    n_sessions = len(session_ids)

    item_meta: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        qid = r["questionId"]
        if qid not in item_meta:
            item_meta[qid] = {
                "id": qid,
                "section": section_name,
                "scored": bool(r["scored"]),
            }

    scored_item_ids = sorted([qid for qid, m in item_meta.items() if m["scored"]])
    pretest_item_ids = sorted([qid for qid, m in item_meta.items() if not m["scored"]])

    n_scored = len(scored_item_ids)
    scored_idx_map = {qid: j for j, qid in enumerate(scored_item_ids)}

    # Sparse/masked storage: person_obs[i] = list of (j, x_ij), item_obs[j] = list of (i, x_ij)
    X_scored = [[0.0] * n_scored for _ in range(n_sessions)]
    M_scored = [[False] * n_scored for _ in range(n_sessions)]

    for r in rows:
        qid = r["questionId"]
        if qid in scored_idx_map:
            s_i = session_idx_map[r["sessionId"]]
            q_j = scored_idx_map[qid]
            X_scored[s_i][q_j] = 1.0 if r["correct"] else 0.0
            M_scored[s_i][q_j] = True

    active_persons = [True] * n_sessions
    active_items = [True] * n_scored

    for _ in range(10):
        changed = False
        for i in range(n_sessions):
            if not active_persons[i]:
                continue
            cnt = 0
            s_val = 0.0
            for j in range(n_scored):
                if active_items[j] and M_scored[i][j]:
                    cnt += 1
                    s_val += X_scored[i][j]
            if cnt == 0 or s_val == 0.0 or s_val == float(cnt):
                active_persons[i] = False
                changed = True

        for j in range(n_scored):
            if not active_items[j]:
                continue
            cnt = 0
            s_val = 0.0
            for i in range(n_sessions):
                if active_persons[i] and M_scored[i][j]:
                    cnt += 1
                    s_val += X_scored[i][j]
            if cnt == 0 or s_val == 0.0 or s_val == float(cnt):
                active_items[j] = False
                changed = True

        if not changed:
            break

    b_scored = [0.0] * n_scored
    for j in range(n_scored):
        cnt = 0
        s_val = 0.0
        for i in range(n_sessions):
            if active_persons[i] and M_scored[i][j]:
                cnt += 1
                s_val += X_scored[i][j]
        if cnt > 0:
            p_j = max(0.02, min(0.98, s_val / float(cnt)))
            b_scored[j] = -math.log(p_j / (1.0 - p_j))

    active_j_indices = [j for j in range(n_scored) if active_items[j]]
    active_i_indices = [i for i in range(n_sessions) if active_persons[i]]

    if active_j_indices:
        mean_b = sum(b_scored[j] for j in active_j_indices) / float(len(active_j_indices))
        for j in active_j_indices:
            b_scored[j] -= mean_b

    theta = [0.0] * n_sessions
    for i in range(n_sessions):
        cnt = 0
        s_val = 0.0
        for j in active_j_indices:
            if M_scored[i][j]:
                cnt += 1
                s_val += X_scored[i][j]
        if cnt > 0:
            p_i = max(0.02, min(0.98, s_val / float(cnt)))
            theta[i] = math.log(p_i / (1.0 - p_i))

    # Pre-index active observations for fast alternating JML updates
    person_active_items = [
        [j for j in active_j_indices if M_scored[i][j]] for i in range(n_sessions)
    ]
    item_active_persons = [
        [i for i in active_i_indices if M_scored[i][j]] for j in range(n_scored)
    ]

    if active_j_indices and active_i_indices:
        for _ in range(100):
            b_prev = list(b_scored)

            # 1. Update active person thetas
            for i in active_i_indices:
                j_list = person_active_items[i]
                if not j_list:
                    continue
                th_i = theta[i]
                grad = 0.0
                info = 0.0
                x_row = X_scored[i]
                for j in j_list:
                    p = prob_correct(th_i, b_scored[j])
                    grad += x_row[j] - p
                    info += p * (1.0 - p)
                if info > 1e-9:
                    step = max(-1.0, min(1.0, grad / info))
                    theta[i] = max(-6.0, min(6.0, th_i + step))

            # 2. Update active item difficulties b_j
            for j in active_j_indices:
                i_list = item_active_persons[j]
                if not i_list:
                    continue
                b_j = b_scored[j]
                grad = 0.0
                info = 0.0
                for i in i_list:
                    p = prob_correct(theta[i], b_j)
                    grad += p - X_scored[i][j]
                    info += p * (1.0 - p)
                if info > 1e-9:
                    step = max(-1.0, min(1.0, grad / info))
                    b_scored[j] = max(-6.0, min(6.0, b_j + step))

            # Re-center active b_j to mean 0
            mean_b = sum(b_scored[j] for j in active_j_indices) / float(
                len(active_j_indices)
            )
            for j in active_j_indices:
                b_scored[j] -= mean_b

            max_delta = max(abs(b_scored[j] - b_prev[j]) for j in active_j_indices)
            if max_delta < 1e-4:
                break

        # Apply JML (L - 1) / L bias correction
        total_seen = sum(len(person_active_items[i]) for i in active_i_indices)
        avg_L = float(total_seen) / float(len(active_i_indices))
        if avg_L > 1.0:
            bias_factor = (avg_L - 1.0) / avg_L
            for j in active_j_indices:
                b_scored[j] *= bias_factor

    # Estimate final theta for ALL sessions (including extreme persons)
    for i in range(n_sessions):
        seen_j = [j for j in range(n_scored) if M_scored[i][j]]
        if seen_j:
            resp_i = [X_scored[i][j] for j in seen_j]
            bs_i = [b_scored[j] for j in seen_j]
            theta[i] = estimate_single_person_theta(resp_i, bs_i, extreme_adjust=0.3)

    results: List[Dict[str, Any]] = []

    for j, qid in enumerate(scored_item_ids):
        obs_i = [i for i in range(n_sessions) if M_scored[i][j]]
        n_obs = len(obs_i)
        n_corr = int(sum(X_scored[i][j] for i in obs_i))
        p_val = float(n_corr) / float(n_obs) if n_obs > 0 else 0.0

        flags: List[str] = []
        if n_obs < 30:
            flags.append("kam_javob")

        is_extreme = (not active_items[j]) or n_obs == 0 or n_corr == 0 or n_corr == n_obs
        if is_extreme:
            flags.append("ekstremal")
            if n_obs > 0:
                adj_corr = (
                    0.3
                    if n_corr == 0
                    else (float(n_obs) - 0.3 if n_corr == n_obs else float(n_corr))
                )
                mean_th = sum(theta[i] for i in obs_i) / float(n_obs)
                b_val = max(
                    -4.5,
                    min(4.5, mean_th - math.log(adj_corr / (float(n_obs) - adj_corr))),
                )
            else:
                b_val = 0.0
        else:
            b_val = b_scored[j]

        if n_obs > 0:
            info_sum = 0.0
            resid_sq_sum = 0.0
            z_sq_sum = 0.0
            for i in obs_i:
                p = prob_correct(theta[i], b_val)
                w = max(1e-9, p * (1.0 - p))
                r_sq = (X_scored[i][j] - p) ** 2
                info_sum += w
                resid_sq_sum += r_sq
                z_sq_sum += r_sq / w

            b_se = 1.0 / math.sqrt(info_sum) if info_sum > 1e-9 else 2.5
            infit = resid_sq_sum / info_sum if info_sum > 1e-9 else 1.0
            outfit = z_sq_sum / float(n_obs)
        else:
            b_se = 2.5
            infit = 1.0
            outfit = 1.0

        if infit < 0.7 or infit > 1.3 or outfit < 0.7 or outfit > 1.3:
            if "moslik" not in flags:
                flags.append("moslik")

        results.append(
            {
                "id": qid,
                "section": section_name,
                "scored": True,
                "n": n_obs,
                "pValue": round(p_val, 4),
                "b": round(b_val, 4),
                "bSE": round(min(9.99, b_se), 4),
                "infit": round(min(9.99, infit), 4),
                "outfit": round(min(9.99, outfit), 4),
                "flags": flags,
            }
        )

    # Stage 2: Calibrate pretest items (scored == 0) with person theta fixed
    for qid in pretest_item_ids:
        q_rows = [r for r in rows if r["questionId"] == qid]
        n_obs = len(q_rows)
        if n_obs == 0:
            results.append(
                {
                    "id": qid,
                    "section": section_name,
                    "scored": False,
                    "n": 0,
                    "pValue": 0.0,
                    "b": 0.0,
                    "bSE": 2.5,
                    "infit": 1.0,
                    "outfit": 1.0,
                    "flags": ["kam_javob", "ekstremal"],
                }
            )
            continue

        resp_thetas = [theta[session_idx_map[r["sessionId"]]] for r in q_rows]
        x_obs = [1.0 if r["correct"] else 0.0 for r in q_rows]
        n_corr = int(sum(x_obs))
        p_val = float(n_corr) / float(n_obs)

        flags = []
        if n_obs < 30:
            flags.append("kam_javob")

        r_target = float(n_corr)
        if n_corr == 0 or n_corr == n_obs:
            flags.append("ekstremal")
            r_target = 0.3 if n_corr == 0 else float(n_obs) - 0.3

        mean_th = sum(resp_thetas) / float(n_obs)
        b_val = max(
            -6.0, min(6.0, mean_th - math.log(r_target / (float(n_obs) - r_target)))
        )

        for _ in range(50):
            sum_p = 0.0
            info = 0.0
            for th in resp_thetas:
                p = prob_correct(th, b_val)
                sum_p += p
                info += p * (1.0 - p)
            if info < 1e-9:
                break
            grad = sum_p - r_target
            step = max(-1.0, min(1.0, grad / info))
            b_val = max(-6.0, min(6.0, b_val + step))
            if abs(step) < 1e-6:
                break

        info_sum = 0.0
        resid_sq_sum = 0.0
        z_sq_sum = 0.0
        for idx_obs, th in enumerate(resp_thetas):
            p = prob_correct(th, b_val)
            w = max(1e-9, p * (1.0 - p))
            r_sq = (x_obs[idx_obs] - p) ** 2
            info_sum += w
            resid_sq_sum += r_sq
            z_sq_sum += r_sq / w

        b_se = 1.0 / math.sqrt(info_sum) if info_sum > 1e-9 else 2.5
        infit = resid_sq_sum / info_sum if info_sum > 1e-9 else 1.0
        outfit = z_sq_sum / float(n_obs)

        if infit < 0.7 or infit > 1.3 or outfit < 0.7 or outfit > 1.3:
            flags.append("moslik")

        results.append(
            {
                "id": qid,
                "section": section_name,
                "scored": False,
                "n": n_obs,
                "pValue": round(p_val, 4),
                "b": round(b_val, 4),
                "bSE": round(min(9.99, b_se), 4),
                "infit": round(min(9.99, infit), 4),
                "outfit": round(min(9.99, outfit), 4),
                "flags": flags,
            }
        )

    return results


def pearson_corr(xs: List[float], ys: List[float]) -> float:
    n = len(xs)
    if n == 0:
        return 0.0
    mx = sum(xs) / float(n)
    my = sum(ys) / float(n)
    num = sum((xs[k] - mx) * (ys[k] - my) for k in range(n))
    den_x = math.sqrt(sum((xs[k] - mx) ** 2 for k in range(n)))
    den_y = math.sqrt(sum((ys[k] - my) ** 2 for k in range(n)))
    if den_x < 1e-12 or den_y < 1e-12:
        return 0.0
    return num / (den_x * den_y)


def run_simulation() -> Tuple[float, Dict[str, Any]]:
    """
    Synthetic verification (--simulate):
    600 students x 60 items (54 scored + 6 pretest).
    Verifies correlation between true b and estimated b is >= 0.95.
    """
    rng = random.Random(2026)
    n_students = 600
    n_items = 60
    n_scored = 54

    true_theta = [rng.gauss(0.0, 1.15) for _ in range(n_students)]
    true_b = [
        -2.2 + 4.4 * (k / float(n_items - 1)) for k in range(n_items)
    ]
    rng.shuffle(true_b)

    mean_scored_b = sum(true_b[:n_scored]) / float(n_scored)
    for k in range(n_scored):
        true_b[k] -= mean_scored_b

    rows: List[Dict[str, Any]] = []
    for s_idx in range(n_students):
        sid = f"sim_sess_{s_idx + 1}"
        th = true_theta[s_idx]
        for q_idx in range(n_items):
            qid = f"sim_q_{q_idx + 1:02d}"
            p = prob_correct(th, true_b[q_idx])
            corr = 1 if rng.random() < p else 0
            is_scored = 1 if q_idx < n_scored else 0
            rows.append(
                {
                    "sessionId": sid,
                    "section": "rw",
                    "questionId": qid,
                    "scored": is_scored,
                    "correct": corr,
                }
            )

    calibrated = calibrate_section("rw", rows)
    cal_map = {item["id"]: item["b"] for item in calibrated}

    est_b = [cal_map[f"sim_q_{q_idx + 1:02d}"] for q_idx in range(n_items)]
    corr = pearson_corr(true_b, est_b)
    rmse = math.sqrt(
        sum((true_b[k] - est_b[k]) ** 2 for k in range(n_items)) / float(n_items)
    )

    payload = {
        "calibratedAt": int(time.time() * 1000),
        "nSessions": n_students,
        "nResponses": len(rows),
        "simulation": {
            "nStudents": n_students,
            "nItems": n_items,
            "correlation": round(corr, 4),
            "rmse": round(rmse, 4),
        },
        "items": calibrated,
    }
    return corr, payload


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bluebook Digital SAT — Rasch (1PL IRT) JML Kalibrlash Skripti"
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        help="Kirish CSV fayli (sessionId,section,questionId,scored,correct)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="item_params.json",
        help="Chiqish JSON fayli (standart: item_params.json)",
    )
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="600 o'quvchi x 60 savol sintetik ma'lumotda JML kalibrlashni tekshirish (korrelyatsiya >= 0.95)",
    )

    args = parser.parse_args()

    if args.simulate:
        corr, payload = run_simulation()
        print(
            f"[SIMULATION] 600 o'quvchi x 60 savol | Haqiqiy b va baholangan b korrelyatsiyasi: r = {corr:.4f} | RMSE = {payload['simulation']['rmse']:.4f}"
        )
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            print(f"[SIMULATION] Natijalar {args.output} fayliga yozildi.")
        if corr < 0.95:
            print(f"XATO: Korrelyatsiya ({corr:.4f}) 0.95 dan past!", file=sys.stderr)
            sys.exit(1)
        print("[SIMULATION] Muvaffaqiyatli o'tdi (r >= 0.95)!")
        sys.exit(0)

    if not args.input:
        parser.error(
            "Iltimos, --input <responses.csv> yoki --simulate parametrini ko'rsating."
        )

    rows_by_section: Dict[str, List[Dict[str, Any]]] = {"rw": [], "math": []}
    all_sessions = set()
    total_responses = 0

    with open(args.input, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = (row.get("sessionId") or "").strip()
            sec = (row.get("section") or "rw").strip().lower()
            qid = (row.get("questionId") or "").strip()
            if not sid or not qid:
                continue
            scored_val = int(row.get("scored", 1))
            correct_val = int(row.get("correct", 0))
            if sec not in rows_by_section:
                rows_by_section[sec] = []
            rows_by_section[sec].append(
                {
                    "sessionId": sid,
                    "section": sec,
                    "questionId": qid,
                    "scored": scored_val,
                    "correct": correct_val,
                }
            )
            all_sessions.add(sid)
            total_responses += 1

    all_calibrated_items: List[Dict[str, Any]] = []
    for sec_name, sec_rows in rows_by_section.items():
        if sec_rows:
            sec_items = calibrate_section(sec_name, sec_rows)
            all_calibrated_items.extend(sec_items)

    output_payload = {
        "calibratedAt": int(time.time() * 1000),
        "nSessions": len(all_sessions),
        "nResponses": total_responses,
        "items": all_calibrated_items,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(
        f"Kalibrlash yakunlandi: {len(all_sessions)} ta sessiya, {total_responses} ta javob, {len(all_calibrated_items)} ta savol -> {args.output}"
    )


if __name__ == "__main__":
    main()
