# örnek feedback listesini okuyup feedback mesajlarını nlp servisine gönderip sistemin verdiği sonucu
# beklenen sonucla karşılaştırıyor başarı oranını cıkarıyor

import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

from app.services.nlp_service import analyze_feedback_message  # noqa: E402


DATASET_PATH = BACKEND_DIR / "app" / "data" / "nlp_test_dataset.json"


def load_dataset() -> list[dict]:
    with DATASET_PATH.open("r", encoding="utf-8") as dataset_file:
        return json.load(dataset_file)


def main() -> None:
    dataset = load_dataset()

    detail_correct = 0
    priority_correct = 0
    fully_correct = 0
    failed_rows = []

    for index, row in enumerate(dataset, start=1):
        result = analyze_feedback_message(
            message=row["text"],
            category_name=row["category"],
        )

        is_detail_correct = result.nlp_detail == row["expected_detail"]
        is_priority_correct = result.message_priority_score == row["expected_priority"]

        if is_detail_correct:
            detail_correct += 1
        if is_priority_correct:
            priority_correct += 1
        if is_detail_correct and is_priority_correct:
            fully_correct += 1

        if not is_detail_correct or not is_priority_correct:
            failed_rows.append(
                {
                    "row": index,
                    "category": row["category"],
                    "tone": row["tone"],
                    "text": row["text"],
                    "expected_detail": row["expected_detail"],
                    "actual_detail": result.nlp_detail,
                    "expected_priority": row["expected_priority"],
                    "actual_priority": result.message_priority_score,
                    "confidence": result.prediction_confidence,
                }
            )

    total = len(dataset)

    print("NLP test sonucu")
    print("----------------")
    print(f"Toplam örnek: {total}")
    print(f"Detail doğru: {detail_correct}/{total} (%{detail_correct / total * 100:.1f})")
    print(f"Priority doğru: {priority_correct}/{total} (%{priority_correct / total * 100:.1f})")
    print(f"Tam doğru: {fully_correct}/{total} (%{fully_correct / total * 100:.1f})")

    if not failed_rows:
        print("\nTüm kayıtlar beklenen sonucu verdi.")
        return

    print("\nYanlış veya eksik tahminler")
    print("--------------------------")

    for failed_row in failed_rows:
        print(f"\n#{failed_row['row']} | {failed_row['category']} | {failed_row['tone']}")
        print(f"Metin: {failed_row['text']}")
        print(
            "Detail: "
            f"beklenen='{failed_row['expected_detail']}', "
            f"çıkan='{failed_row['actual_detail']}'"
        )
        print(
            "Priority: "
            f"beklenen={failed_row['expected_priority']}, "
            f"çıkan={failed_row['actual_priority']}"
        )
        print(f"Confidence: {failed_row['confidence']}")


if __name__ == "__main__":
    main()
