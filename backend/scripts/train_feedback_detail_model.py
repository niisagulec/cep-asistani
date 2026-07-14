import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_training_dataset.json"
MODEL_DIR = BACKEND_DIR / "app" / "ml" / "models"
MODEL_PATH = MODEL_DIR / "feedback_detail_model.joblib"


def load_dataset() -> pd.DataFrame:
    with DATASET_PATH.open("r", encoding="utf-8") as dataset_file:
        data = json.load(dataset_file)

    dataframe = pd.DataFrame(data)
    required_columns = {"category", "text", "nlp_detail", "tone", "priority"}
    missing_columns = required_columns - set(dataframe.columns)

    if missing_columns:
        raise ValueError(f"Dataset eksik kolon içeriyor: {sorted(missing_columns)}")

    dataframe["model_input"] = (
        "Kategori: "
        + dataframe["category"].astype(str)
        + " | Mesaj: "
        + dataframe["text"].astype(str)
    )

    return dataframe


def main() -> None:
    dataframe = load_dataset()

    print("Feedback detail modeli eğitimi")
    print("------------------------------")
    print(f"Dataset: {DATASET_PATH}")
    print(f"Toplam kayıt: {len(dataframe)}")
    print("\nKategori dağılımı:")
    print(dataframe["category"].value_counts().sort_index())
    print("\nDetail dağılımı:")
    print(dataframe["nlp_detail"].value_counts().sort_index())

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        dataframe["model_input"],
        dataframe["nlp_detail"],
        test_size=0.20,
        random_state=42,
        stratify=dataframe["nlp_detail"],
    )

    model = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    analyzer="char_wb",
                    ngram_range=(3, 5),
                    min_df=2,
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                CalibratedClassifierCV(
                    estimator=LinearSVC(
                        C=1.0,
                        class_weight="balanced",
                        random_state=42,
                    ),
                    cv=3,
                ),
            ),
        ]
    )

    model.fit(train_texts, train_labels)
    train_predictions = model.predict(train_texts)
    predictions = model.predict(test_texts)

    train_accuracy = accuracy_score(train_labels, train_predictions)
    accuracy = accuracy_score(test_labels, predictions)
    gap = train_accuracy - accuracy

    cross_validation = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cross_validation_scores = cross_val_score(
        model,
        dataframe["model_input"],
        dataframe["nlp_detail"],
        cv=cross_validation,
        scoring="accuracy",
    )

    print("\nTest sonucu")
    print("-----------")
    print("Model: char TF-IDF + Calibrated LinearSVC")
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

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    print("\nModel kaydedildi:")
    print(MODEL_PATH)


if __name__ == "__main__":
    main()
