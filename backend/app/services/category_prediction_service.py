from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import joblib


CATEGORY_SUGGESTION_THRESHOLD = 0.80

MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "ml"
    / "models"
    / "feedback_category_model.joblib"
)


@dataclass
class CategoryPredictionResult:
    category_name: Optional[str]
    confidence: float
    top_categories: List[Dict[str, float]]
    model_available: bool


_category_model = None


def _load_category_model():
    global _category_model

    if _category_model is not None:
        return _category_model

    if not MODEL_PATH.exists():
        return None

    _category_model = joblib.load(MODEL_PATH)
    return _category_model


def predict_feedback_category(message: str) -> CategoryPredictionResult:
    model = _load_category_model()
    if model is None:
        return CategoryPredictionResult(
            category_name=None,
            confidence=0.0,
            top_categories=[],
            model_available=False,
        )

    probabilities = model.predict_proba([message])[0]
    classes = list(model.classes_)
    ranked = sorted(
        zip(classes, probabilities),
        key=lambda item: item[1],
        reverse=True,
    )

    top_categories = [
        {"category_name": category_name, "confidence": round(float(confidence), 2)}
        for category_name, confidence in ranked[:3]
    ]

    best_category, best_confidence = ranked[0]

    return CategoryPredictionResult(
        category_name=best_category,
        confidence=round(float(best_confidence), 2),
        top_categories=top_categories,
        model_available=True,
    )


def should_suggest_category_change(
    selected_category_name: str,
    predicted_category_name: Optional[str],
    prediction_confidence: float,
) -> bool:
    if not predicted_category_name:
        return False

    if predicted_category_name == selected_category_name:
        return False

    return prediction_confidence >= CATEGORY_SUGGESTION_THRESHOLD
