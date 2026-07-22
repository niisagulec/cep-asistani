from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

import joblib


FEEDBACK_LABEL = "FEEDBACK"
NOT_FEEDBACK_LABEL = "NOT_FEEDBACK"
UNCERTAIN_LABEL = "UNCERTAIN"
MODEL_PATH = Path(__file__).resolve().parents[1] / "ml" / "models" / "feedback_relevance_model.joblib"
FEEDBACK_ACCEPT_THRESHOLD = 0.60
NOT_FEEDBACK_REJECT_THRESHOLD = 0.70
UNCERTAIN_REVIEW_THRESHOLD = 0.55

CLEAR_NON_FEEDBACK_PHRASES = {
    "hello",
    "hello world",
    "hi",
    "merhaba",
    "selam",
    "test",
    "test test",
    "deneme",
    "deneme deneme",
    "lorem ipsum",
    "nasılsın",
    "nasilsin",
    "günaydın",
    "gunaydin",
    "iyi günler",
    "iyi gunler",
    "teşekkürler",
    "tesekkurler",
    "tamam",
    "tamamdır",
    "tamamdir",
}

COURTESY_ONLY_PHRASES = [
    "hayırlı işler",
    "hayirli isler",
    "kolay gelsin",
    "iyi çalışmalar",
    "iyi calismalar",
    "iyi mesailer",
]

FEEDBACK_SIGNAL_KEYWORDS = [
    "açım",
    "acim",
    "üşüdüm",
    "usudum",
    "üşüdük",
    "usuduk",
    "sıcak",
    "sicak",
    "sıcağ",
    "sicag",
    "soğuk",
    "soguk",
    "buz",
    "buz gibi",
    "ayaz",
    "yanıyor",
    "yaniyor",
    "yanıyoruz",
    "yaniyoruz",
    "kokuyor",
    "koku",
    "kirli",
    "pis",
    "bozuk",
    "arıza",
    "ariza",
    "çalışmıyor",
    "calismiyor",
    "açılmıyor",
    "acilmiyor",
    "kopuyor",
    "geç",
    "gec",
    "gecikti",
    "kaldı",
    "kaldi",
    "yok",
    "bitti",
    "eksik",
    "sorun",
    "problem",
    "tehlike",
    "tehlikeli",
    "risk",
    "kaza",
    "yangın",
    "yangin",
    "elektrik",
    "kablo",
    "priz",
    "robot",
    "makine",
    "sensör",
    "sensor",
    "bant",
    "kafa",
    "yaklaşamıyor",
    "yaklasamiyor",
    "aşın",
    "asin",
    "yıpran",
    "yipran",
    "soyul",
    "kaçak",
    "kacak",
    "hızlı",
    "hizli",
    "kaba",
    "şikayet",
    "sikayet",
    "şikayetçiyim",
    "sikayetciyim",
    "davran",
    "tavır",
    "tavir",
    "tutum",
    "azarl",
    "tersli",
    "bağır",
    "bagir",
    "hakaret",
    "saygısız",
    "saygisiz",
    "servis",
    "kaptan",
    "yol",
    "yollar",
    "bellemedi",
    "şoför",
    "sofor",
    "yemek",
    "yemekhane",
    "tuvalet",
    "lavabo",
    "klima",
    "pervane",
    "vantilatör",
    "vantilator",
    "kan ter",
    "üşü",
    "usu",
    "dondu",
    "donuyor",
    "donuyoruz",
    "titriyor",
    "titremek",
    "sibirya",
    "erzurum",
    "mont",
    "montaj",
    "depo",
    "internet",
    "vpn",
    "bilgisayar",
    "ürün",
    "urun",
    "etiket",
    "barkod",
    "seri no",
    "okunmuyor",
    "okunmuyo",
    "silinmiş",
    "silinmis",
    "yazı",
    "yazi",
    "izin",
    "bordro",
    "maaş",
    "maas",
    "yan hak",
    "hediye çeki",
    "hediye ceki",
    "geçersiz kod",
    "gecersiz kod",
    "bahçe",
    "bahce",
    "çardak",
    "cardak",
    "pet şişe",
    "pet sise",
    "çekirdek",
    "cekirdek",
    "postabaşı",
    "postabasi",
    "adamına göre",
    "adamina gore",
    "muamele",
    "kayır",
    "kayir",
    "haksızlık",
    "haksizlik",
    "zor iş",
    "zor is",
    "öneri",
    "oneri",
    "almalıyız",
    "almaliyiz",
    "alınmalı",
    "alinmali",
    "koymalıyız",
    "koymaliyiz",
    "konulmalı",
    "konulmali",
    "ekleyelim",
    "eklenmeli",
    "olmalı",
    "olmali",
    "olsa iyi",
    "daha kolay",
    "kolaylaştır",
    "kolaylastir",
]

UNCERTAIN_CONTEXT_PHRASES = {
    "aynı şey yine oldu",
    "ayni sey yine oldu",
    "yine aynı şey",
    "yine ayni sey",
    "bugün yine aynı",
    "bugun yine ayni",
    "bu sorun yine oldu",
}

STRONG_FEEDBACK_PROBLEM_PHRASES = (
    "geçersiz kod",
    "gecersiz kod",
    "hediye çeki çalışmıyor",
    "hediye ceki calismiyor",
    "çek kullanılamıyor",
    "cek kullanilamiyor",
)


@dataclass
class FeedbackRelevanceResult:
    label: str
    confidence: float
    needs_manual_review: bool
    reason: str


def normalize_text(text: str) -> str:
    lowered_text = text.lower().replace("i̇", "i")
    return " ".join(lowered_text.strip().split())


def contains_feedback_signal(text: str) -> bool:
    normalized_text = normalize_text(text)
    return any(keyword in normalized_text for keyword in FEEDBACK_SIGNAL_KEYWORDS)


def is_courtesy_only_message(text: str) -> bool:
    normalized_text = normalize_text(text)
    words = normalized_text.split()

    if not any(phrase in normalized_text for phrase in COURTESY_ONLY_PHRASES):
        return False

    allowed_extra_words = {
        "usta",
        "abi",
        "abla",
        "arkadaşlar",
        "arkadaslar",
        "hocam",
        "kolay",
        "gelsin",
        "hayırlı",
        "hayirli",
        "işler",
        "isler",
        "iyi",
        "çalışmalar",
        "calismalar",
        "mesailer",
    }

    return all(word in allowed_extra_words for word in words)


@lru_cache(maxsize=1)
def load_feedback_relevance_model():
    if not MODEL_PATH.exists():
        return None

    try:
        return joblib.load(MODEL_PATH)
    except Exception:
        return None


def predict_feedback_relevance_with_model(message: str) -> Optional[FeedbackRelevanceResult]:
    model = load_feedback_relevance_model()
    if model is None:
        return None

    prediction = model.predict([message])[0]
    probabilities = model.predict_proba([message])[0]
    probability_by_label = dict(zip(model.classes_, probabilities))
    confidence = round(float(probability_by_label.get(prediction, 0)), 2)

    if prediction == FEEDBACK_LABEL and confidence >= FEEDBACK_ACCEPT_THRESHOLD:
        return FeedbackRelevanceResult(
            label=FEEDBACK_LABEL,
            confidence=confidence,
            needs_manual_review=False,
            reason="Mesaj çalışan geri bildirimi olarak sınıflandırıldı.",
        )

    if prediction == NOT_FEEDBACK_LABEL and confidence >= NOT_FEEDBACK_REJECT_THRESHOLD:
        return FeedbackRelevanceResult(
            label=NOT_FEEDBACK_LABEL,
            confidence=confidence,
            needs_manual_review=False,
            reason="Mesaj kurumsal geri bildirim gibi görünmüyor.",
        )

    if prediction == UNCERTAIN_LABEL and confidence >= UNCERTAIN_REVIEW_THRESHOLD:
        return FeedbackRelevanceResult(
            label=UNCERTAIN_LABEL,
            confidence=confidence,
            needs_manual_review=True,
            reason="Mesaj geri bildirim olabilir ancak bağlam açısından yetersiz.",
        )

    return FeedbackRelevanceResult(
        label=UNCERTAIN_LABEL,
        confidence=confidence,
        needs_manual_review=True,
        reason="Mesajın geri bildirim niteliği model tarafından net ayrıştırılamadı.",
    )


SLANG_PROTEST_WORDS = {
    "yuh",
    "oha",
    "lan",
    "çüş",
    "cus",
}

SLANG_PROTEST_PHRASES = [
    "boş yap",
    "bos yap",
]

def is_slang_or_protest(message: str) -> bool:
    # Use normalized/cleaned message words
    words = set(message.split())
    if any(sw in words for sw in SLANG_PROTEST_WORDS):
        return True
    if any(sp in message for sp in SLANG_PROTEST_PHRASES):
        return True
    return False


def analyze_feedback_relevance(message: str) -> FeedbackRelevanceResult:
    normalized_message = normalize_text(message)

    if is_slang_or_protest(normalized_message):
        return FeedbackRelevanceResult(
            label=NOT_FEEDBACK_LABEL,
            confidence=0.95,
            needs_manual_review=False,
            reason="Mesaj alakasız veya uygunsuz argo/sataşma ifadeleri içeriyor.",
        )

    if (
        normalized_message in CLEAR_NON_FEEDBACK_PHRASES
        or is_courtesy_only_message(normalized_message)
    ):
        return FeedbackRelevanceResult(
            label=NOT_FEEDBACK_LABEL,
            confidence=0.95,
            needs_manual_review=False,
            reason="Mesaj selamlaşma, test veya alakasız kısa ifade gibi görünüyor.",
        )

    # Heuristic fallback: if the message is short and lacks any feedback signals, mark it as uncertain
    if len(normalized_message.split()) < 5 and not contains_feedback_signal(normalized_message):
        return FeedbackRelevanceResult(
            label=UNCERTAIN_LABEL,
            confidence=0.45,
            needs_manual_review=True,
            reason="Mesaj çok kısa ve belirgin bir geri bildirim sinyali (arıza, temizlik, şikayet, öneri vb.) içermiyor.",
        )

    if normalized_message in UNCERTAIN_CONTEXT_PHRASES:
        return FeedbackRelevanceResult(
            label=UNCERTAIN_LABEL,
            confidence=0.45,
            needs_manual_review=True,
            reason="Mesaj geri bildirim olabilir ancak bağlam açısından yetersiz.",
        )

    if any(
        problem_phrase in normalized_message
        for problem_phrase in STRONG_FEEDBACK_PROBLEM_PHRASES
    ):
        return FeedbackRelevanceResult(
            label=FEEDBACK_LABEL,
            confidence=0.90,
            needs_manual_review=False,
            reason="Mesaj açık bir kurumsal sorun bildirimi içeriyor.",
        )

    model_result = predict_feedback_relevance_with_model(normalized_message)
    if model_result is not None:
        return model_result

    # Model dosyası yüklenemezse sistem tamamen durmasın diye eski sinyal kontrolü
    # yalnızca acil yedek mekanizma olarak kullanılır.
    if contains_feedback_signal(normalized_message):
        return FeedbackRelevanceResult(
            label=FEEDBACK_LABEL,
            confidence=0.55,
            needs_manual_review=False,
            reason="Mesaj çalışan geri bildirimiyle ilişkili sinyaller içeriyor.",
        )

    return FeedbackRelevanceResult(
        label=UNCERTAIN_LABEL,
        confidence=0.50,
        needs_manual_review=True,
        reason="Mesajın geri bildirim niteliği net değil.",
    )
