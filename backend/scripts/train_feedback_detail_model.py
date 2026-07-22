import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.cluster import KMeans
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import (
    StratifiedGroupKFold,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.services.content_filter_service import normalize_message


DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_training_dataset.json"
HARD_EXAMPLES_PATH = BACKEND_DIR / "app" / "data" / "feedback_hard_examples.json"
MODEL_DIR = BACKEND_DIR / "app" / "ml" / "models"
ACTIVE_MODEL_PATH = MODEL_DIR / "feedback_detail_model.joblib"
CANDIDATE_MODEL_PATH = MODEL_DIR / "feedback_detail_model_candidate.joblib"


def load_dataset(include_hard_examples: bool = True) -> pd.DataFrame:
    with DATASET_PATH.open("r", encoding="utf-8") as dataset_file:
        data = json.load(dataset_file)

    if include_hard_examples:
        with HARD_EXAMPLES_PATH.open("r", encoding="utf-8") as hard_examples_file:
            hard_examples = json.load(hard_examples_file)

        existing_keys = {
            (
                str(record["category"]).strip(),
                " ".join(str(record["text"]).lower().replace("i̇", "i").split()),
            )
            for record in data
        }
        data.extend(
            record
            for record in hard_examples
            if (
                str(record["category"]).strip(),
                " ".join(str(record["text"]).lower().replace("i̇", "i").split()),
            )
            not in existing_keys
        )

    dataframe = pd.DataFrame(data)
    required_columns = {"category", "text", "nlp_detail", "tone", "priority"}
    missing_columns = required_columns - set(dataframe.columns)

    if missing_columns:
        raise ValueError(f"Dataset eksik kolon içeriyor: {sorted(missing_columns)}")

    dataframe["model_input"] = (
        "Kategori: "
        + dataframe["category"].astype(str)
        + " | Mesaj: "
        + dataframe["text"].astype(str).map(normalize_message)
    )

    return dataframe


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Feedback detail modelini aktif modele dokunmadan eğitir."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CANDIDATE_MODEL_PATH,
        help=(
            "Aday modelin kaydedileceği yol. Varsayılan: "
            f"{CANDIDATE_MODEL_PATH}"
        ),
    )
    parser.add_argument(
        "--without-hard-examples",
        action="store_true",
        help="Kontrollü zor örnekleri aday eğitimine dahil etmez.",
    )
    parser.add_argument(
        "--features",
        choices=("char", "char-word"),
        default="char",
        help="TF-IDF özellik yapısı. Varsayılan mevcut karakter yapısıdır.",
    )
    parser.add_argument(
        "--c",
        type=float,
        default=1.0,
        help="LinearSVC düzenlileştirme parametresi. Pozitif olmalıdır.",
    )
    parser.add_argument(
        "--validation",
        choices=("random", "grouped"),
        default="random",
        help="Rastgele veya benzer mesajları aynı tarafta tutan doğrulama.",
    )
    parser.add_argument(
        "--per-category",
        action="store_true",
        help="Her ana kategori için yalnızca kendi detaylarını içeren ayrı model eğitir.",
    )
    return parser.parse_args()


def build_features(feature_mode: str):
    char_tfidf = TfidfVectorizer(
        lowercase=True,
        analyzer="char_wb",
        ngram_range=(3, 6) if feature_mode == "char-word" else (3, 5),
        min_df=2,
        sublinear_tf=True,
    )

    if feature_mode == "char":
        return char_tfidf

    return FeatureUnion(
        transformer_list=[
            ("char_tfidf", char_tfidf),
            (
                "word_tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    analyzer="word",
                    ngram_range=(1, 2),
                    min_df=2,
                    sublinear_tf=True,
                ),
            ),
        ]
    )


def build_model(feature_mode: str, c_value: float) -> Pipeline:
    return Pipeline(
        steps=[
            ("features", build_features(feature_mode)),
            (
                "classifier",
                CalibratedClassifierCV(
                    estimator=LinearSVC(
                        C=c_value,
                        class_weight="balanced",
                        random_state=42,
                    ),
                    cv=3,
                ),
            ),
        ]
    )


def train_per_category_models(
    dataframe: pd.DataFrame,
    feature_mode: str,
    c_value: float,
) -> dict[str, Pipeline]:
    category_models = {}

    for category_name, category_rows in dataframe.groupby("category"):
        if category_name == "Diğer" or category_rows["nlp_detail"].nunique() < 2:
            continue

        category_model = build_model(feature_mode, c_value)
        category_model.fit(category_rows["model_input"], category_rows["nlp_detail"])
        category_models[str(category_name)] = category_model
        print(
            f"- {category_name}: {len(category_rows)} kayıt, "
            f"{category_rows['nlp_detail'].nunique()} detay"
        )

    return category_models


def build_semantic_groups(dataframe: pd.DataFrame, groups_per_label: int = 5):
    groups = pd.Series(index=dataframe.index, dtype="object")

    for label, label_rows in dataframe.groupby("nlp_detail"):
        cluster_count = min(groups_per_label, len(label_rows))
        vectors = TfidfVectorizer(
            lowercase=True,
            analyzer="char_wb",
            ngram_range=(3, 5),
            min_df=1,
            max_features=5000,
            sublinear_tf=True,
        ).fit_transform(label_rows["model_input"])
        cluster_ids = KMeans(
            n_clusters=cluster_count,
            random_state=42,
            n_init=10,
        ).fit_predict(vectors)

        for row_index, cluster_id in zip(label_rows.index, cluster_ids):
            groups.loc[row_index] = f"{label}:{cluster_id}"

    return groups

def main() -> None:
    args = parse_args()
    output_path = args.output.expanduser().resolve()

    if output_path == ACTIVE_MODEL_PATH.resolve():
        raise ValueError(
            "Güvenlik nedeniyle eğitim scripti aktif modelin üzerine yazamaz. "
            "Aday modeli ayrı bir dosyaya kaydet."
        )
    if args.c <= 0:
        raise ValueError("C parametresi pozitif olmalıdır.")

    dataframe = load_dataset(include_hard_examples=not args.without_hard_examples)

    print("Feedback detail modeli eğitimi")
    print("------------------------------")
    print(f"Dataset: {DATASET_PATH}")
    if not args.without_hard_examples:
        print(f"Kontrollü zor örnekler: {HARD_EXAMPLES_PATH}")
    print(f"Toplam kayıt: {len(dataframe)}")
    print("\nKategori dağılımı:")
    print(dataframe["category"].value_counts().sort_index())
    print("\nDetail dağılımı:")
    print(dataframe["nlp_detail"].value_counts().sort_index())

    if args.per_category:
        print("\nKategoriye özel modeller eğitiliyor:")
        model = train_per_category_models(dataframe, args.features, args.c)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, output_path)
        print("\nAday kategori model paketi kaydedildi:")
        print(output_path)
        print(f"Aktif model değiştirilmedi: {ACTIVE_MODEL_PATH}")
        return

    semantic_groups = None
    if args.validation == "grouped":
        semantic_groups = build_semantic_groups(dataframe)
        holdout_splitter = StratifiedGroupKFold(
            n_splits=5,
            shuffle=True,
            random_state=42,
        )
        train_indices, test_indices = next(
            holdout_splitter.split(
                dataframe["model_input"],
                dataframe["nlp_detail"],
                groups=semantic_groups,
            )
        )
        train_texts = dataframe.loc[train_indices, "model_input"]
        test_texts = dataframe.loc[test_indices, "model_input"]
        train_labels = dataframe.loc[train_indices, "nlp_detail"]
        test_labels = dataframe.loc[test_indices, "nlp_detail"]
    else:
        train_texts, test_texts, train_labels, test_labels = train_test_split(
            dataframe["model_input"],
            dataframe["nlp_detail"],
            test_size=0.20,
            random_state=42,
            stratify=dataframe["nlp_detail"],
        )

    model = build_model(args.features, args.c)

    model.fit(train_texts, train_labels)
    train_predictions = model.predict(train_texts)
    predictions = model.predict(test_texts)

    train_accuracy = accuracy_score(train_labels, train_predictions)
    accuracy = accuracy_score(test_labels, predictions)
    gap = train_accuracy - accuracy

    cross_validation = (
        StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
        if args.validation == "grouped"
        else StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    )
    cross_validation_scores = cross_val_score(
        model,
        dataframe["model_input"],
        dataframe["nlp_detail"],
        cv=cross_validation,
        scoring="accuracy",
        groups=semantic_groups,
    )

    print("\nTest sonucu")
    print("-----------")
    print(
        f"Model: {args.features} TF-IDF + Calibrated LinearSVC "
        f"(C={args.c}, validation={args.validation})"
    )
    print(f"Train accuracy: %{train_accuracy * 100:.2f}")
    print(f"Accuracy: %{accuracy * 100:.2f}")
    print(f"Train/Test gap: %{gap * 100:.2f}")
    print(
        "Cross-validation: "
        f"%{cross_validation_scores.mean() * 100:.2f} "
        f"± %{cross_validation_scores.std() * 100:.2f}"
    )
    print("\nClassification report:")
    print(classification_report(test_labels, predictions, zero_division=0))
    print("\nConfusion matrix:")
    labels = sorted(dataframe["nlp_detail"].unique())
    matrix = confusion_matrix(test_labels, predictions, labels=labels)
    matrix_df = pd.DataFrame(matrix, index=labels, columns=labels)
    print(matrix_df)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)

    print("\nAday model kaydedildi:")
    print(output_path)
    print(f"Aktif model değiştirilmedi: {ACTIVE_MODEL_PATH}")


if __name__ == "__main__":
    main()
