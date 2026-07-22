import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from fastapi import HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

from app.services.content_filter_service import (
    analyze_feedback_category_alignment,
    validate_feedback_category_match,
    validate_feedback_message_content,
)
from app.services.feedback_relevance_service import (
    FEEDBACK_LABEL,
    NOT_FEEDBACK_LABEL,
    UNCERTAIN_LABEL,
    analyze_feedback_relevance,
)
from app.services.nlp_service import analyze_feedback_message
from app.routers.feedback import calculate_total_priority_score


DEFAULT_TEST_CASES_PATH = (
    BACKEND_DIR / "app" / "data" / "feedback_guardrail_test_cases.json"
)
NON_STRICT_DETAIL_BEHAVIORS = {
    "SPECIFIC_OR_GENERAL",
    "GENERAL_IF_LOW_CONFIDENCE",
    "Çoklu Konu",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Feedback pipeline testlerini çalıştırır.")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_TEST_CASES_PATH,
        help="Çalıştırılacak JSON test dosyası.",
    )
    return parser.parse_args()


def load_test_cases(test_cases_path: Path) -> list[dict]:
    with test_cases_path.open("r", encoding="utf-8") as test_cases_file:
        return json.load(test_cases_file)


def run_current_pipeline(test_case: dict) -> dict:
    message = test_case["text"]
    selected_category = test_case["selected_category"]

    try:
        clean_message = validate_feedback_message_content(message)
        relevance_result = analyze_feedback_relevance(clean_message)

        if relevance_result.label == NOT_FEEDBACK_LABEL:
            return {
                "actual_action": "WARN_OR_REJECT",
                "actual_detail": None,
                "actual_confidence": relevance_result.confidence,
                "actual_priority": None,
                "error": relevance_result.reason,
            }

        category_alignment = analyze_feedback_category_alignment(
            message=clean_message,
            selected_category_name=selected_category,
        )
        if category_alignment.category_mismatch:
            return {
                "actual_action": "SUGGEST_CATEGORY_CHANGE",
                "actual_detail": category_alignment.suggested_category,
                "actual_confidence": None,
                "actual_priority": None,
                "error": category_alignment.reason,
            }

        analysis_result = analyze_feedback_message(
            message=clean_message,
            category_name=selected_category,
        )
    except HTTPException as exc:
        return {
            "actual_action": "REJECT",
            "actual_detail": None,
            "actual_confidence": None,
            "actual_priority": None,
            "error": exc.detail,
        }

    if relevance_result.label == UNCERTAIN_LABEL and category_alignment.needs_manual_review:
        return {
            "actual_action": "ACCEPT_WITH_MANUAL_REVIEW",
            "actual_detail": None,
            "actual_confidence": relevance_result.confidence,
            "actual_priority": None,
            "error": relevance_result.reason,
        }

    needs_manual_review = (
        category_alignment.needs_manual_review
        or analysis_result.prediction_confidence < 0.45
    )

    return {
        "actual_action": "ACCEPT_WITH_MANUAL_REVIEW" if needs_manual_review else "ACCEPT",
        "actual_detail": analysis_result.nlp_detail,
        "actual_confidence": round(analysis_result.prediction_confidence, 2),
        "actual_priority": analysis_result.message_priority_score,
        "error": None,
    }


def is_expected_behavior(test_case: dict, result: dict) -> bool:
    expected_action = test_case["expected_action"]
    actual_action = result["actual_action"]

    if expected_action == "REJECT":
        return actual_action == "REJECT"

    if expected_action == "WARN_OR_REJECT":
        return actual_action in {"WARN_OR_REJECT", "REJECT"}

    if expected_action == "SUGGEST_CATEGORY_CHANGE":
        if actual_action != "SUGGEST_CATEGORY_CHANGE":
            return False
        expected_category = test_case.get("expected_category")
        return expected_category is None or result["actual_detail"] == expected_category

    if expected_action in {
        "ACCEPT",
        "ACCEPT_WITH_MANUAL_REVIEW",
        "ACCEPT_WITH_LOW_CONFIDENCE",
    }:
        if actual_action not in {"ACCEPT", "ACCEPT_WITH_MANUAL_REVIEW"}:
            return False

        expected_detail_behavior = test_case.get("expected_detail_behavior")
        if (
            expected_detail_behavior
            and expected_detail_behavior not in NON_STRICT_DETAIL_BEHAVIORS
        ):
            allowed_details = expected_detail_behavior.split("_OR_")
            if result["actual_detail"] not in allowed_details:
                return False

        expected_priority_behavior = test_case.get("expected_priority_behavior")
        if expected_priority_behavior == "CRITICAL" and result["actual_priority"] != 5:
            return False

        if expected_priority_behavior == "SUGGESTION" and result["actual_priority"] > 2:
            return False

        expected_priority = test_case.get("expected_priority")
        if expected_priority is not None and result["actual_priority"] != expected_priority:
            return False

        return True

    return False


def main() -> None:
    args = parse_args()
    test_cases_path = args.dataset.expanduser().resolve()
    test_cases = load_test_cases(test_cases_path)
    rows = []

    for index, test_case in enumerate(test_cases, start=1):
        result = run_current_pipeline(test_case)
        is_ok = is_expected_behavior(test_case, result)
        rows.append(
            {
                "index": index,
                "text": test_case["text"],
                "selected_category": test_case["selected_category"],
                "expected_stage": test_case["expected_stage"],
                "expected_action": test_case["expected_action"],
                "actual_action": result["actual_action"],
                "actual_detail": result["actual_detail"],
                "actual_confidence": result["actual_confidence"],
                "actual_priority": result["actual_priority"],
                "error": result["error"],
                "consistency_group": test_case.get("consistency_group"),
                "is_ok": is_ok,
            }
        )

    total_count = len(rows)
    ok_count = sum(1 for row in rows if row["is_ok"])
    failed_rows = [row for row in rows if not row["is_ok"]]

    print("Feedback guardrail test sonucu")
    print("------------------------------")
    print(f"Test dosyası: {test_cases_path}")
    print(f"Toplam test: {total_count}")
    print(f"Beklenen davranış: {ok_count}/{total_count} (%{ok_count / total_count * 100:.1f})")

    print("\nBeklenen aşama dağılımı:")
    for stage, count in Counter(row["expected_stage"] for row in rows).items():
        print(f"- {stage}: {count}")

    print("\nMevcut pipeline aksiyon dağılımı:")
    for action, count in Counter(row["actual_action"] for row in rows).items():
        print(f"- {action}: {count}")

    consistency_rows = [row for row in rows if row["consistency_group"]]
    consistency_groups = {
        row["consistency_group"] for row in consistency_rows
    }
    consistent_groups = sum(
        all(
            row["is_ok"]
            for row in consistency_rows
            if row["consistency_group"] == group
        )
        for group in consistency_groups
    )
    if consistency_groups:
        print("\nTutarlılık sonucu:")
        print(f"- Grup: {consistent_groups}/{len(consistency_groups)}")
        print(
            "- Mesaj: "
            f"{sum(row['is_ok'] for row in consistency_rows)}/{len(consistency_rows)}"
        )

    priority_totals = {
        calculate_total_priority_score(sender_score, 3)
        for sender_score in (1, 2, 3, 4)
    }
    priority_is_consistent = len(priority_totals) == 1
    print(
        "- Pozisyondan bağımsız öncelik: "
        f"{'BAŞARILI' if priority_is_consistent else 'BAŞARISIZ'}"
    )
    if not priority_is_consistent:
        raise SystemExit(1)

    if not failed_rows:
        print("\nTüm testler beklenen davranışta.")
        return

    print("\nBeklenen davranıştan sapan örnekler:")
    for row in failed_rows:
        print("\n" + "=" * 80)
        print(f"#{row['index']} | {row['expected_stage']} | {row['expected_action']}")
        print(f"Metin: {row['text']}")
        print(f"Seçilen kategori: {row['selected_category']}")
        print(f"Mevcut aksiyon: {row['actual_action']}")
        if row["error"]:
            print(f"Hata: {row['error']}")
        else:
            print(f"Detay: {row['actual_detail']}")
            print(f"Güven: {row['actual_confidence']}")
            print(f"Öncelik: {row['actual_priority']}")


if __name__ == "__main__":
    main()
