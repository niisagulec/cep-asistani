import sys
from pathlib import Path

import joblib


BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BACKEND_DIR / "app" / "ml" / "models" / "feedback_category_model.joblib"


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(
            "Kullanım:\n"
            "python scripts/predict_feedback_category.py "
            "\"Servis şoförü kırmızı ışıkta geçti.\""
        )

    text = sys.argv[1]

    if not MODEL_PATH.exists():
        raise SystemExit(
            f"Model bulunamadı: {MODEL_PATH}\n"
            "Önce scripts/train_feedback_category_model.py çalıştırılmalı."
        )

    model = joblib.load(MODEL_PATH)
    prediction = model.predict([text])[0]

    print("Ana kategori tahmin sonucu")
    print("-------------------------")
    print(f"Mesaj: {text}")
    print(f"category: {prediction}")

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba([text])[0]
        classes = model.classes_
        confidence = max(probabilities)
        top_results = sorted(
            zip(classes, probabilities),
            key=lambda item: item[1],
            reverse=True,
        )[:5]

        print(f"prediction_confidence: %{confidence * 100:.2f}")
        print("\nTop olasılıklar:")
        for label, probability in top_results:
            print(f"- {label}: %{probability * 100:.2f}")
    else:
        print("prediction_confidence: Bu model predict_proba desteklemiyor.")


if __name__ == "__main__":
    main()
