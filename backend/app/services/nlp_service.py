from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import unicodedata

import joblib


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "ml" / "models" / "feedback_detail_model.joblib"

TRAINED_CATEGORIES = {
    "Yemekhane",
    "Servis",
    "Ortak Alan",
    "Teknik Destek",
    "İK / Personel İşleri",
    "Güvenlik",
    "Çalışma Ortamı",
    "Öneri ve İyileştirme",
    "Diğer",
}

DEFAULT_DETAIL_BY_CATEGORY = {
    "Yemekhane": "Genel Yemekhane Bildirimi",
    "Servis": "Genel Servis Bildirimi",
    "Ortak Alan": "Genel Ortak Alan Bildirimi",
    "Teknik Destek": "Genel Teknik Destek Bildirimi",
    "İK / Personel İşleri": "Genel İK Bildirimi",
    "Güvenlik": "Genel Güvenlik Bildirimi",
    "Çalışma Ortamı": "Genel Çalışma Ortamı Bildirimi",
    "Öneri ve İyileştirme": "Genel Öneri/İyileştirme Bildirimi",
    "Diğer": "Belirsiz/Kategorilenemeyen",
}

CRITICAL_SAFETY_KEYWORDS = [
    "can güven",
    "can guven",
    "tehlike",
    "tehlikeli",
    "tehlikede",
    "kaza",
    "yaralanma",
    "yangın",
    "yangin",
    "kırmızı ışık",
    "kirmizi isik",
    "aşırı hız",
    "asiri hiz",
    "fren",
    "risk",
    "acil",
    "patlama",
    "gaz",
    "zehirlenme",
    "duman",
    "elektrik",
    "kıvılcım",
    "kivilcim",
    "çöktü",
    "coktu",
    "tamamen durdu",
    "kapı tam kapanmadan",
    "kapi tam kapanmadan",
    "telefonla oyn",
    "telefonla konuş",
    "telefonla konus",
    "direksiyonda telefon",
    "seyir halinde telefon",
    "sigara iç",
    "sigara ic",
    "robot kolu",
    "robot",
    "makine",
    "sensör",
    "sensor",
    "az kalsın",
    "az kalsin",
    "kafasını kopar",
    "kafasini kopar",
    "kimse yaklaşamıyor",
    "kimse yaklasamiyor",
]

SHUTTLE_DRIVER_CONTEXT_KEYWORDS = [
    "servisçi",
    "servisci",
    "servis şoförü",
    "servis soforu",
    "şoför",
    "sofor",
    "sürücü",
    "surucu",
    "kaptan",
    "ramazan abi",
    "vardiya arabası",
    "vardiya arabasi",
    "vardiyanın arabası",
    "vardiyanin arabasi",
    "dayı",
    "dayi",
]

SHUTTLE_ROUTE_KEYWORDS = [
    "güzergah",
    "guzergah",
    "durak",
    "yol",
    "yollar",
    "yolları",
    "yollari",
    "bellemedi",
    "bilmiyor",
    "kaybol",
    "yanlış yol",
    "yanlis yol",
]

DRIVER_BEHAVIOR_KEYWORDS = [
    "telefonla oyn",
    "telefonla konuş",
    "telefonla konus",
    "telefon",
    "sigara",
    "tersliyor",
    "tersledi",
    "kaba",
    "laf söyleyince",
    "laf soyleyince",
    "bağır",
    "bagir",
    "hızlı kullan",
    "hizli kullan",
    "hızlı",
    "hizli",
    "hız yap",
    "hiz yap",
    "f1",
    "pist",
    "ralli",
    "yarış",
    "yaris",
    "uçuyor",
    "ucuyor",
    "savrul",
    "koltuklara tutun",
    "tutunmak",
    "kollarımız koptu",
    "kollarimiz koptu",
    "agresif",
    "sert fren",
    "ani fren",
    "viraj",
    "virajlara",
    "yığılıyor",
    "yigiliyor",
    "uyukl",
]

ELECTRICAL_RISK_CATEGORIES = {
    "Teknik Destek",
    "Güvenlik",
    "Çalışma Ortamı",
    "Ortak Alan",
    "Diğer",
}

ELECTRICAL_RISK_KEYWORDS = [
    "elektrik",
    "kablo",
    "priz",
    "kaynak",
    "kaynak makinesi",
    "ark yap",
    "ark yapıyor",
    "ark yapiyor",
    "statik",
    "akım",
    "akim",
    "aşın",
    "asin",
    "yıpran",
    "yipran",
    "soyul",
    "çarp",
    "carp",
    "kaçak",
    "kacak",
    "yük",
    "yuk",
    "kıvılcım",
    "kivilcim",
    "dokunmaya kork",
    "tüyleri diken",
    "tuyleri diken",
]

CAFETERIA_FOOD_QUALITY_KEYWORDS = [
    "bayat",
    "bozuk",
    "ekşi",
    "eksi",
    "çürük",
    "curuk",
    "çiğ",
    "cig",
    "pişmemiş",
    "pismemis",
    "yanık",
    "yanik",
    "tatsız",
    "tatsiz",
    "tuzu fazla",
    "tuzsuz",
    "soğuk yemek",
    "soguk yemek",
    "ekmek",
    "yemek kalitesi",
    "kötü",
    "kotu",
    "yemekler kötü",
    "yemekler kotu",
    "yemek kötü",
    "yemek kotu",
    "lezzet",
    "lezzetsiz",
    "tadı",
    "tadi",
    "tat",
]

HR_PAYROLL_KEYWORDS = [
    "maaş",
    "maas",
    "ücret",
    "ucret",
    "fazla mesai",
    "mesai ücret",
    "mesai ucret",
    "eksik hesap",
    "eksik yat",
    "bordro",
    "prim",
    "yan hak",
    "ödeme",
    "odeme",
]

HR_SHIFT_PLANNING_KEYWORDS = [
    "vardiya",
    "vardiya listesi",
    "vardiya plan",
    "vardiya çizelge",
    "vardiya cizelge",
    "çalışma plan",
    "calisma plan",
    "çalışma çizelge",
    "calisma cizelge",
    "mesai plan",
    "liste geç",
    "liste gec",
    "geç açıklan",
    "gec aciklan",
    "planlayamıyor",
    "planlayamiyoruz",
]

WORKPLACE_AIR_QUALITY_KEYWORDS = [
    "kimyasal",
    "boya kokusu",
    "koku",
    "kokuyor",
    "kokudan",
    "genz",
    "genzim",
    "genzimiz",
    "nefes alam",
    "havalandırma",
    "havalandirma",
    "duman",
    "gaz",
    "buhar",
]

MACHINE_SAFETY_KEYWORDS = [
    "robot",
    "robot kolu",
    "makine",
    "sensör",
    "sensor",
    "bant",
    "üretim hattı",
    "uretim hatti",
    "montaj hattı",
    "montaj hatti",
    "kafa",
    "kafasını kopar",
    "kafasini kopar",
    "az kalsın",
    "az kalsin",
    "yaklaşamıyor",
    "yaklasamiyor",
    "sapıttı",
    "sapitti",
    "kontrolsüz",
    "kontrolsuz",
]

HYGIENE_DETAIL_CATEGORIES = {
    "Yemekhane",
    "Ortak Alan",
    "Çalışma Ortamı",
}

HYGIENE_DETAIL_KEYWORDS = [
    "çöp",
    "cop",
    "pis",
    "pislik",
    "kirli",
    "temiz",
    "temiz değil",
    "temiz degil",
    "temizlik",
    "hijyen",
    "leke",
    "lekeli",
    "koku",
    "kokuyor",
    "kokudan",
    "lağım",
    "lagim",
    "kanalizasyon",
    "sinek",
    "böcek",
    "bocek",
    "haşere",
    "hasere",
    "mikrop",
    "küf",
    "kuf",
    "küflen",
    "kuflen",
    "sabun",
    "peçete",
    "pecete",
    "tuvalet kağıdı",
    "tuvalet kagidi",
    "bahçe",
    "bahce",
    "çardak",
    "cardak",
    "pet şişe",
    "pet sise",
    "çekirdek",
    "cekirdek",
    "kabuk",
]

COMMON_AREA_SUPPLY_KEYWORDS = [
    "tuvalet",
    "lavabo",
    "sabun",
    "peçete",
    "pecete",
    "tuvalet kağıdı",
    "tuvalet kagidi",
]

COMMON_AREA_CLEANLINESS_KEYWORDS = [
    "bahçe",
    "bahce",
    "çardak",
    "cardak",
    "pet şişe",
    "pet sise",
    "çekirdek",
    "cekirdek",
    "kabuk",
    "çöp",
    "cop",
    "pis",
    "pislik",
    "kirli",
    "koku",
    "kokuyor",
]

PERSONNEL_BEHAVIOR_CATEGORIES = {
    "İK / Personel İşleri",
    "Yemekhane",
    "Ortak Alan",
    "Güvenlik",
    "Çalışma Ortamı",
    "Diğer",
}

PERSONNEL_BEHAVIOR_KEYWORDS = [
    "davran",
    "davranış",
    "davranis",
    "tavır",
    "tavir",
    "tutum",
    "kaba",
    "saygısız",
    "saygisiz",
    "ters",
    "tersli",
    "azarl",
    "bağır",
    "bagir",
    "hakaret",
    "aşağıla",
    "asagila",
    "alay",
    "iletişim",
    "iletisim",
    "üslup",
    "uslup",
    "surat",
    "güler yüz",
    "guler yuz",
    "nazik",
    "saygı",
    "saygi",
    "şikayetçiyim",
    "sikayetciyim",
    "şikayet",
    "sikayet",
    "iş veren",
    "is veren",
    "iş ver",
    "is ver",
    "usta",
    "amir",
    "şef",
    "sef",
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
    "kitliyor",
    "sosyal medya",
    "istek at",
    "istek atıyor",
    "istek atiyor",
    "takip isteği",
    "takip istegi",
    "mesaj at",
    "yazıyor",
    "yaziyor",
    "rahatsız",
    "rahatsiz",
    "taciz",
    "kızlara",
    "kizlara",
]

TECHNICAL_LABEL_KEYWORDS = [
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
]

WORKPLACE_ERGONOMY_KEYWORDS = [
    "masa",
    "masalar",
    "masaların",
    "masalarin",
    "sandalye",
    "sandalyeler",
    "koltuk",
    "ayakları",
    "ayaklari",
    "ayak",
    "sallan",
    "oynuyor",
    "oynuyo",
    "gevşek",
    "gevsek",
    "kırık",
    "kirik",
    "gıcır",
    "gicir",
    "ergonomi",
    "ergonomik",
]

WORKPLACE_TEMPERATURE_KEYWORDS = [
    "sıcak",
    "sicak",
    "sıcağ",
    "sicag",
    "soğuk",
    "soguk",
    "yanıyor",
    "yaniyor",
    "yanıyoruz",
    "yaniyoruz",
    "üşü",
    "usu",
    "dondu",
    "donuyor",
    "sibirya",
    "erzurum",
    "ayaz",
    "buz",
    "titremek",
    "titriyor",
    "buz kesti",
    "mont",
    "pervane",
    "vantilatör",
    "vantilator",
    "kan ter",
    "adana",
    "klima",
    "ısıtma",
    "isitma",
    "soğutma",
    "sogutma",
]

SHUTTLE_COMFORT_KEYWORDS = [
    "koltuk",
    "koltuklar",
    "deri",
    "derileri",
    "yırtık",
    "yirtik",
    "yırtılmış",
    "yirtilmis",
    "toz",
    "toprak",
    "kirli",
    "oturacak",
    "yer yok",
    "klima",
]


def is_workplace_temperature_message(category_name: str, message: str) -> bool:
    return category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_TEMPERATURE_KEYWORDS,
    )


def is_shuttle_route_message(message: str) -> bool:
    return contains_any_keyword(
        message,
        SHUTTLE_DRIVER_CONTEXT_KEYWORDS,
    ) and contains_any_keyword(message, SHUTTLE_ROUTE_KEYWORDS)

CRITICAL_HYGIENE_KEYWORDS = [
    "çöp",
    "cop",
    "taşmış",
    "tasmis",
    "koku",
    "kokuyor",
    "kokudan",
    "lağım",
    "lagim",
    "kanalizasyon",
    "sinek",
    "böcek",
    "bocek",
    "haşere",
    "hasere",
    "mikrop",
    "küf",
    "kuf",
    "küflen",
    "kuflen",
    "zehirlenme",
    "hasta etti",
    "hastalandık",
    "hastalandik",
]

SUGGESTION_KEYWORDS = [
    "öneri",
    "oneri",
    "öneriyorum",
    "oneriyorum",
    "öneriyoruz",
    "oneriyoruz",
    "rica ederim",
    "rica ederiz",
    "faydalı olur",
    "faydali olur",
    "olabilir",
    "kurulabilir",
    "eklenebilir",
    "ekleyelim",
    "eklenmeli",
    "almalıyız",
    "almaliyiz",
    "alınmalı",
    "alinmali",
    "koymalıyız",
    "koymaliyiz",
    "konulmalı",
    "konulmali",
    "olmalı",
    "olmali",
    "olsa iyi",
    "daha kolay",
    "kolaylaştır",
    "kolaylastir",
    "artırılabilir",
    "artirilabilir",
    "iyileştirme",
    "iyilestirme",
]


@dataclass
class FeedbackAnalysisResult:
    nlp_detail: str
    prediction_confidence: float
    message_priority_score: int


@lru_cache(maxsize=1)
def load_feedback_detail_model():
    if not MODEL_PATH.exists():
        return None

    return joblib.load(MODEL_PATH)


def build_model_input(category_name: str, message: str) -> str:
    return f"Kategori: {category_name} | Mesaj: {message}"


def normalize_turkish_text(text: str, *, remove_diacritics: bool = False) -> str:
    normalized_text = unicodedata.normalize("NFKC", text).casefold()
    normalized_text = normalized_text.replace("i̇", "i")

    if not remove_diacritics:
        return normalized_text

    normalized_text = unicodedata.normalize("NFD", normalized_text)
    normalized_text = "".join(
        character
        for character in normalized_text
        if unicodedata.category(character) != "Mn"
    )

    return unicodedata.normalize("NFKC", normalized_text)


def contains_any_keyword(message: str, keywords: list[str]) -> bool:
    normalized_message = normalize_turkish_text(message)
    ascii_normalized_message = normalize_turkish_text(message, remove_diacritics=True)

    for keyword in keywords:
        normalized_keyword = normalize_turkish_text(keyword)
        ascii_normalized_keyword = normalize_turkish_text(keyword, remove_diacritics=True)

        if normalized_keyword in normalized_message:
            return True

        if ascii_normalized_keyword in ascii_normalized_message:
            return True

    return False


def is_driver_behavior_message(message: str) -> bool:
    return contains_any_keyword(
        message,
        SHUTTLE_DRIVER_CONTEXT_KEYWORDS,
    ) and contains_any_keyword(message, DRIVER_BEHAVIOR_KEYWORDS)


def calculate_message_priority_score(message: str, category_name: str) -> int:
    if contains_any_keyword(message, CRITICAL_SAFETY_KEYWORDS):
        return 5

    if (
        category_name in ELECTRICAL_RISK_CATEGORIES
        and contains_any_keyword(message, ELECTRICAL_RISK_KEYWORDS)
    ):
        return 5

    if is_workplace_temperature_message(category_name, message):
        return 3

    if is_driver_behavior_message(message) and contains_any_keyword(
        message,
        [
            "telefon",
            "sigara",
            "hız",
            "hiz",
            "f1",
            "pist",
            "yarış",
            "yaris",
            "uçuyor",
            "ucuyor",
            "savrul",
            "koltuklara tutun",
            "tutunmak",
            "kırmızı ışık",
            "kirmizi isik",
            "uyukl",
            "sert fren",
            "ani fren",
            "viraj",
        ],
    ):
        return 5

    if contains_any_keyword(message, CRITICAL_HYGIENE_KEYWORDS):
        return 5

    if contains_any_keyword(message, SUGGESTION_KEYWORDS):
        return 2

    return 3


def adjusted_rule_confidence(
    original_detail: str,
    override_detail: str,
    prediction_confidence: float,
    floor: float = 0.62,
    cap: float = 0.78,
) -> float:
    if original_detail == override_detail:
        return prediction_confidence

    return min(max(prediction_confidence, floor), cap)


def apply_rule_based_overrides(
    category_name: str,
    message: str,
    nlp_detail: str,
    prediction_confidence: float,
) -> tuple[str, float]:
    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_FOOD_QUALITY_KEYWORDS,
    ):
        override_detail = "Yemek Kalitesi"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "İK / Personel İşleri" and contains_any_keyword(
        message,
        HR_PAYROLL_KEYWORDS,
    ):
        override_detail = "Maaş/Yan Haklar"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "İK / Personel İşleri" and contains_any_keyword(
        message,
        HR_SHIFT_PLANNING_KEYWORDS,
    ):
        override_detail = "Vardiya/Çalışma Planı"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_AIR_QUALITY_KEYWORDS,
    ):
        override_detail = "Hava Kalitesi/Koku"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Güvenlik" and contains_any_keyword(
        message,
        MACHINE_SAFETY_KEYWORDS,
    ):
        override_detail = "İş Güvenliği Riski"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if (
        category_name in ELECTRICAL_RISK_CATEGORIES
        and contains_any_keyword(message, ELECTRICAL_RISK_KEYWORDS)
    ):
        override_detail = "Güvenlik/Risk"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if is_driver_behavior_message(message):
        override_detail = "Şoför Davranışı"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Servis" and is_shuttle_route_message(message):
        override_detail = "Güzergah/Durak"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if (
        category_name in PERSONNEL_BEHAVIOR_CATEGORIES
        and contains_any_keyword(message, PERSONNEL_BEHAVIOR_KEYWORDS)
    ):
        override_detail = "Personel Davranışı"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        TECHNICAL_LABEL_KEYWORDS,
    ):
        override_detail = "Donanım Sorunu"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_ERGONOMY_KEYWORDS,
    ):
        override_detail = "Ergonomi"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if is_workplace_temperature_message(category_name, message):
        override_detail = "Isıtma/Soğutma"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Servis" and contains_any_keyword(
        message,
        SHUTTLE_COMFORT_KEYWORDS,
    ):
        override_detail = "Araç Konforu"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if (
        category_name == "Öneri ve İyileştirme"
        and contains_any_keyword(message, SUGGESTION_KEYWORDS)
        and prediction_confidence < 0.60
    ):
        return "Çalışan Deneyimi", 0.68

    if (
        category_name in HYGIENE_DETAIL_CATEGORIES
        and contains_any_keyword(message, HYGIENE_DETAIL_KEYWORDS)
    ):
        override_detail = "Hijyen/Temizlik"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Ortak Alan":
        if contains_any_keyword(message, COMMON_AREA_SUPPLY_KEYWORDS):
            override_detail = "Tuvalet/Sarf Malzeme"
            return override_detail, adjusted_rule_confidence(
                nlp_detail,
                override_detail,
                prediction_confidence,
            )

        if contains_any_keyword(message, COMMON_AREA_CLEANLINESS_KEYWORDS):
            override_detail = "Fiziksel Düzen"
            return override_detail, adjusted_rule_confidence(
                nlp_detail,
                override_detail,
                prediction_confidence,
            )

    return nlp_detail, prediction_confidence


def predict_feedback_detail(category_name: str, message: str) -> tuple[str, float]:
    if category_name == "Diğer":
        return DEFAULT_DETAIL_BY_CATEGORY["Diğer"], 0.50

    if category_name not in TRAINED_CATEGORIES:
        return DEFAULT_DETAIL_BY_CATEGORY.get(category_name, "Genel Bildirim"), 0.0

    model = load_feedback_detail_model()
    if model is None:
        return DEFAULT_DETAIL_BY_CATEGORY.get(category_name, "Genel Bildirim"), 0.35

    model_input = build_model_input(category_name=category_name, message=message)
    prediction = model.predict([model_input])[0]

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba([model_input])[0]
        confidence = float(max(probabilities))
    else:
        confidence = 0.0

    return str(prediction), confidence


def analyze_feedback_message(message: str, category_name: str) -> FeedbackAnalysisResult:
    nlp_detail, prediction_confidence = predict_feedback_detail(
        category_name=category_name,
        message=message,
    )
    nlp_detail, prediction_confidence = apply_rule_based_overrides(
        category_name=category_name,
        message=message,
        nlp_detail=nlp_detail,
        prediction_confidence=prediction_confidence,
    )
    message_priority_score = calculate_message_priority_score(message, category_name)

    return FeedbackAnalysisResult(
        nlp_detail=nlp_detail,
        prediction_confidence=prediction_confidence,
        message_priority_score=message_priority_score,
    )
