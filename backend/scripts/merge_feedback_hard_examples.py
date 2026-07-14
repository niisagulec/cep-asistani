import argparse
import json
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_training_dataset.json"
HARD_EXAMPLES_PATH = BACKEND_DIR / "app" / "data" / "feedback_hard_examples.json"
BACKUP_DIR = BACKEND_DIR / "app" / "data" / "backups"

REQUIRED_FIELDS = {"category", "text", "nlp_detail", "tone", "priority"}


def load_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as json_file:
        data = json.load(json_file)

    if not isinstance(data, list):
        raise ValueError(f"{path} liste formatında olmalı.")

    return data


def validate_records(records: list[dict], source_name: str) -> None:
    for index, record in enumerate(records, start=1):
        missing_fields = REQUIRED_FIELDS - set(record.keys())

        if missing_fields:
            raise ValueError(
                f"{source_name} içinde {index}. kayıt eksik alan içeriyor: "
                f"{sorted(missing_fields)}"
            )

        if not str(record["text"]).strip():
            raise ValueError(f"{source_name} içinde {index}. kaydın text alanı boş.")


def normalize_text(text: str) -> str:
    return " ".join(str(text).lower().replace("i̇", "i").split())


def make_record_key(record: dict) -> tuple[str, str]:
    return (str(record["category"]).strip(), normalize_text(record["text"]))


def print_distribution(title: str, records: list[dict], field_name: str) -> None:
    print(f"\n{title}:")
    distribution = Counter(record[field_name] for record in records)

    for value, count in sorted(distribution.items()):
        print(f"- {value}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Hard example kayıtlarını ana feedback eğitim verisine güvenli şekilde ekler."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Veriyi gerçekten yazar. Bu parametre yoksa sadece önizleme yapar.",
    )
    args = parser.parse_args()

    dataset_records = load_json(DATASET_PATH)
    hard_records = load_json(HARD_EXAMPLES_PATH)

    validate_records(dataset_records, "Ana veri seti")
    validate_records(hard_records, "Hard example dosyası")

    existing_keys = {make_record_key(record) for record in dataset_records}
    records_to_add = []
    duplicate_records = []

    for record in hard_records:
        record_key = make_record_key(record)

        if record_key in existing_keys:
            duplicate_records.append(record)
            continue

        records_to_add.append(record)
        existing_keys.add(record_key)

    merged_records = dataset_records + records_to_add

    print("Feedback hard example merge kontrolü")
    print("-----------------------------------")
    print(f"Ana veri seti: {DATASET_PATH}")
    print(f"Ek örnek dosyası: {HARD_EXAMPLES_PATH}")
    print(f"Mevcut kayıt: {len(dataset_records)}")
    print(f"Ek dosyadaki kayıt: {len(hard_records)}")
    print(f"Eklenecek yeni kayıt: {len(records_to_add)}")
    print(f"Duplicate atlanan kayıt: {len(duplicate_records)}")
    print(f"Merge sonrası toplam kayıt: {len(merged_records)}")

    print_distribution("Eklenecek kayıtların kategori dağılımı", records_to_add, "category")
    print_distribution("Eklenecek kayıtların detay dağılımı", records_to_add, "nlp_detail")

    if not args.apply:
        print("\nDry-run tamamlandı. Ana veri setine henüz hiçbir şey yazılmadı.")
        print("Yazmak için şu komutu çalıştır:")
        print("python scripts/merge_feedback_hard_examples.py --apply")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = (
        BACKUP_DIR
        / f"feedback_training_dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    shutil.copy2(DATASET_PATH, backup_path)

    DATASET_PATH.write_text(
        json.dumps(merged_records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("\nAna veri seti güncellendi.")
    print(f"Yedek oluşturuldu: {backup_path}")


if __name__ == "__main__":
    main()
