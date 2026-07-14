import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline


BACKEND_DIR = Path(__file__).resolve().parents[1]
FEEDBACK_DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_training_dataset.json"
EXTRA_DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_relevance_extra_examples.json"
MODEL_DIR = BACKEND_DIR / "app" / "ml" / "models"
MODEL_PATH = MODEL_DIR / "feedback_relevance_model.joblib"

FEEDBACK_LABEL = "FEEDBACK"
MAX_FEEDBACK_SAMPLE_SIZE = 900

GENERATED_NOT_FEEDBACK_EXAMPLES = [
    "merhaba nasılsınız",
    "selam millet",
    "iyi akşamlar",
    "herkese kolay gelsin",
    "hayırlı işler",
    "kolay gelsin usta",
    "bugün nasılsınız",
    "çay molasına çıkıyorum",
    "öğlen dışarıdan yemek söyleyelim mi",
    "bu akşam maç var mı",
    "hafta sonu planınız ne",
    "bana da kahve alın",
    "çok uykum var",
    "canım sıkıldı",
    "deneme mesajıdır",
    "sadece test ediyorum",
    "admin paneli test",
    "rastgele yazı yazıyorum",
    "bu bir denemedir",
    "aaaa bbbb cccc",
    "qwerty asdfgh",
    "123 456 789",
    "naber",
    "napıyorsunuz",
    "görüşürüz",
    "teşekkür ederim",
    "tamam oldu",
    "evet",
    "hayır",
    "olur",
    "sonra bakarız",
    "kuşlar beni de alın",
    "bugün hava güneşli",
    "dışarıda yağmur var",
    "kedim çok tatlı",
    "müzik açalım mı",
    "spotify çalışıyor mu",
    "telefonumu evde unutmuşum",
    "cüzdanımı kaybettim gören var mı",
    "anahtarımı bulan var mı",
]

GENERATED_UNCERTAIN_EXAMPLES = [
    "yine oldu",
    "bunu çözün",
    "çok kötü olmuş",
    "bu durum kötü",
    "bakılması gerekiyor",
    "buna biri baksın",
    "hep aynı şey",
    "dün de böyleydi",
    "bugün yine sıkıntı var",
    "rahatsız edici",
    "memnun değiliz",
    "düzeltilmesi lazım",
    "bu şekilde olmaz",
    "süreç kötü",
    "yeter artık",
    "bu iş böyle gitmez",
    "kimse ilgilenmiyor",
    "acil bakılsın",
    "kontrol eder misiniz",
    "sorun devam ediyor",
    "daha iyi olmalı",
    "daha düzenli olmalı",
    "eskisi daha iyiydi",
    "çok yetersiz",
    "hiç memnun değilim",
    "bu konu can sıkıyor",
    "aynı problem tekrarlandı",
    "bir çözüm bulunmalı",
    "bu konuda dönüş bekliyorum",
    "lütfen ilgilenin",
]

GENERATED_SHORT_FEEDBACK_EXAMPLES = [
    "bugün üşüdük",
    "çok üşüdük",
    "ofis soğuk",
    "depo çok soğuk",
    "depo buz gibi",
    "hattın içi buz gibi",
    "çalışma alanı soğuk",
    "klima çok soğutuyor",
    "ofis çok sıcak",
    "bugün çok sıcaktı",
    "preshane çok sıcak",
    "içerisi yanıyor",
    "kan ter içinde kaldık",
    "açım yemek yetmedi",
    "yemek yetmedi",
    "yemek soğuk",
    "tabaklar kirli",
    "masalar kirli",
    "tuvalet pis",
    "lavaboda sabun yok",
    "peçete bitmiş",
    "çöpler taşmış",
    "koridor kokuyor",
    "servis geç geldi",
    "servis çok hızlı",
    "şoför hızlı kullanıyor",
    "şoför kaba konuşuyor",
    "servis durağı atladı",
    "vpn kopuyor",
    "internet yok",
    "bilgisayar açılmıyor",
    "yazıcı çalışmıyor",
    "yazıcı kağıt sıkıştırıyor",
    "ekran donuyor",
    "uygulama hata veriyor",
    "masalar sallanıyor",
    "sandalyeler kırık",
    "aydınlatma yetersiz",
    "çok gürültü var",
    "havalandırma çalışmıyor",
    "yangın tüpü eski",
    "kablo aşınmış",
    "priz kıvılcım çıkarıyor",
    "kaynak makinesi ark yapıyor",
    "matkap çalışmıyor",
    "robot kolu tehlikeli",
    "amir kaba davranıyor",
    "usta bağırıyor",
    "izin sonucu görünmüyor",
    "bordro hatalı",
    "maaş eksik yatmış",
    "su sebili almalıyız",
    "dinlenme alanı artırılmalı",
]


def load_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as json_file:
        return json.load(json_file)


def build_dataset() -> pd.DataFrame:
    feedback_records = load_json(FEEDBACK_DATASET_PATH)
    extra_records = load_json(EXTRA_DATASET_PATH)

    feedback_rows = [
        {
            "text": record["text"],
            "label": FEEDBACK_LABEL,
        }
        for record in feedback_records
        if record.get("text")
    ]

    extra_rows = [
        {
            "text": record["text"],
            "label": record["label"],
        }
        for record in extra_records
        if record.get("text") and record.get("label")
    ]

    generated_rows = [
        {"text": text, "label": "NOT_FEEDBACK"}
        for text in GENERATED_NOT_FEEDBACK_EXAMPLES
    ] + [
        {"text": text, "label": "UNCERTAIN"}
        for text in GENERATED_UNCERTAIN_EXAMPLES
    ] + [
        {"text": text, "label": FEEDBACK_LABEL}
        for text in GENERATED_SHORT_FEEDBACK_EXAMPLES
    ]

    df = pd.DataFrame(feedback_rows + extra_rows + generated_rows)
    df["text"] = df["text"].astype(str).str.strip()
    df = df.drop_duplicates(subset=["text", "label"]).reset_index(drop=True)

    feedback_df = df[df["label"] == FEEDBACK_LABEL]
    other_df = df[df["label"] != FEEDBACK_LABEL]

    if len(feedback_df) > MAX_FEEDBACK_SAMPLE_SIZE:
        feedback_df = feedback_df.sample(
            n=MAX_FEEDBACK_SAMPLE_SIZE,
            random_state=42,
        )

    df = (
        pd.concat([feedback_df, other_df], ignore_index=True)
        .sample(frac=1, random_state=42)
        .reset_index(drop=True)
    )
    return df


def build_model() -> Pipeline:
    return Pipeline(
        steps=[
            (
                "features",
                FeatureUnion(
                    [
                        (
                            "word",
                            TfidfVectorizer(
                                analyzer="word",
                                ngram_range=(1, 2),
                                min_df=1,
                                sublinear_tf=True,
                            ),
                        ),
                        (
                            "char",
                            TfidfVectorizer(
                                analyzer="char_wb",
                                ngram_range=(3, 5),
                                min_df=1,
                                sublinear_tf=True,
                            ),
                        ),
                    ]
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    C=4.0,
                    max_iter=2000,
                    random_state=42,
                ),
            ),
        ]
    )


def main() -> None:
    df = build_dataset()
    X = df["text"]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = build_model()
    model.fit(X_train, y_train)

    train_predictions = model.predict(X_train)
    test_predictions = model.predict(X_test)
    train_accuracy = accuracy_score(y_train, train_predictions)
    test_accuracy = accuracy_score(y_test, test_predictions)

    min_class_count = y.value_counts().min()
    cv_splits = min(5, min_class_count)
    cv_scores = []
    if cv_splits >= 2:
        cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)
        cv_scores = cross_val_score(build_model(), X, y, cv=cv, scoring="accuracy")

    final_model = build_model()
    final_model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_model, MODEL_PATH)

    print("Feedback relevance modeli eğitimi")
    print("----------------------------------")
    print(f"Dataset: {FEEDBACK_DATASET_PATH}")
    print(f"Ek veri: {EXTRA_DATASET_PATH}")
    print(f"Toplam kayıt: {len(df)}")
    print("\nLabel dağılımı:")
    print(y.value_counts())

    print("\nTest sonucu")
    print("-----------")
    print("Model: word+char TF-IDF + Logistic Regression")
    print(f"Train accuracy: %{train_accuracy * 100:.2f}")
    print(f"Accuracy: %{test_accuracy * 100:.2f}")
    print(f"Train/Test gap: %{(train_accuracy - test_accuracy) * 100:.2f}")
    if len(cv_scores):
        print(
            f"Cross-validation: %{cv_scores.mean() * 100:.2f} "
            f"± %{cv_scores.std() * 100:.2f}"
        )

    print("\nClassification report:")
    print(classification_report(y_test, test_predictions))
    print("\nConfusion matrix:")
    labels = sorted(y.unique())
    print(pd.DataFrame(confusion_matrix(y_test, test_predictions, labels=labels), index=labels, columns=labels))
    print(f"\nModel kaydedildi:\n{MODEL_PATH}")


if __name__ == "__main__":
    main()
