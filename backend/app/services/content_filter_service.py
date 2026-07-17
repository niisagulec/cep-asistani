import re
from collections import Counter
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status


MAX_MESSAGE_LENGTH = 1000
MIN_LETTER_COUNT = 3
MAX_SINGLE_TOKEN_LENGTH = 45
TURKISH_VOWELS = "aeıioöuü"

FORBIDDEN_PATTERNS = [
    # Küfür/hakaret kökleri. Tam listeyi kullanıcıya göstermiyoruz;
    # amaç mesajı engellemek, sistemi manipüle etmeyi kolaylaştırmamak.
    r"\bamk\b",
    r"\baq\b",
    r"\bsiktir\w*",
    r"\bsik\w*",
    r"\samına\s*",
    r"\bamina\s*",
    r"\borospu\w*",
    r"\bpiç\w*",
    r"\bpic\w*",
    r"\bpezevenk\w*",
    r"\byavşak\w*",
    r"\byavsak\w*",
    r"\bgerizekalı\w*",
    r"\bgerizekali\w*",
    r"\bsalak\w*",
    r"\baptal\w*",
    r"\bhayvan\b",
    r"\bşerefsiz\w*",
    r"\bserefsiz\w*",
]

CONTEXTUAL_FORBIDDEN_PATTERNS = [
    # "mal" kelimesi iş bağlamında geçebilir: mal taşıyan, mal kabul,
    # sarf malzeme vb. Bu yüzden tek başına yasaklanmaz; sadece hakaret
    # kalıplarında engellenir.
    r"\bmal\s+mısın\b",
    r"\bmal\s+misin\b",
    r"\bmal\s+gibi\b",
    r"\bmal\s+herif\b",
    r"\bmal\s+adam\b",
]

FORBIDDEN_MESSAGE = (
    "Mesaj uygunsuz ifade içeriyor. "
    "Lütfen daha uygun bir dille tekrar yazın."
)

SAFE_FORBIDDEN_OVERLAP_PATTERNS = [
    r"\bsıkış\w*",
    r"\bsikis\w*",
    r"\bsıkışt\w*",
    r"\bsikist\w*",
]

SUSPICIOUS_COMMAND_PATTERNS = [
    r"\bselect\b.+\bfrom\b",
    r"\binsert\b.+\binto\b",
    r"\bupdate\b.+\bset\b",
    r"\bdelete\b.+\bfrom\b",
    r"\bdrop\b.+\btable\b",
    r"\btruncate\b.+\btable\b",
    r"<\s*script\b",
    r"\balert\s*\(",
]

CATEGORY_KEYWORDS = {
    "Yemekhane": [
        "yemekhane",
        "yemek",
        "menü",
        "menu",
        "çorba",
        "corba",
        "tatlı",
        "tatli",
        "tabak",
        "kaşık",
        "kasik",
        "çatal",
        "catal",
        "salata",
    ],
    "Servis": [
        "servis",
        "şoför",
        "sofor",
        "servisçi",
        "servisci",
        "sürücü",
        "surucu",
        "durak",
        "güzergah",
        "guzergah",
        "araç",
        "arac",
        "minibüs",
        "minibus",
        "kaptan",
        "vardiya arabası",
        "vardiya arabasi",
        "ralli",
        "viraj",
        "virajlar",
        "yığılıyor",
        "yigiliyor",
        "yol",
        "yollar",
        "yolları",
        "yollari",
        "bellemedi",
        "bilmiyor",
        "kaybol",
        "koltuk",
        "koltuklar",
        "deri",
        "yırtık",
        "yirtik",
        "yırtılmış",
        "yirtilmis",
    ],
    "Teknik Destek": [
        "bilgisayar",
        "laptop",
        "vpn",
        "internet",
        "yazılım",
        "yazilim",
        "uygulama",
        "sistem",
        "şifre",
        "sifre",
        "yazıcı",
        "yazici",
        "printer",
        "sunucu",
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
        "kablo",
        "priz",
        "elektrik",
        "matkap",
        "tetik",
        "alet",
        "kaynak",
        "kaynak makinesi",
        "kıvılcım",
        "kivilcim",
        "ark yap",
        "gövde",
        "govde",
        "aşın",
        "asin",
        "yıpran",
        "yipran",
        "soyul",
    ],
    "İK / Personel İşleri": [
        "izin",
        "bordro",
        "maaş",
        "maas",
        "yan hak",
        "personel",
        "ik",
        "özlük",
        "ozluk",
        "işe giriş",
        "ise giris",
        "çıkış işlemi",
        "cikis islemi",
        "usta",
        "amir",
        "şef",
        "sef",
        "davran",
        "davranış",
        "davranis",
        "tavır",
        "tavir",
        "tutum",
        "kaba",
        "saygısız",
        "saygisiz",
        "şikayet",
        "sikayet",
        "şikayetçiyim",
        "sikayetciyim",
        "iş ver",
        "is ver",
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
    ],
    "Güvenlik": [
        "güvenlik",
        "guvenlik",
        "yangın",
        "yangin",
        "kaza",
        "risk",
        "tehlike",
        "acil",
        "kamera",
        "kapı",
        "kapi",
        "iş güvenliği",
        "is guvenligi",
        "robot",
        "robot kolu",
        "makine",
        "sensör",
        "sensor",
        "bant",
        "kafa",
        "yaklaşamıyor",
        "yaklasamiyor",
    ],
    "Ortak Alan": [
        "tuvalet",
        "lavabo",
        "koridor",
        "mutfak",
        "toplantı",
        "toplanti",
        "dinlenme alanı",
        "dinlenme alani",
        "sosyal alan",
        "ortak alan",
        "bahçe",
        "bahce",
        "çardak",
        "cardak",
        "pet şişe",
        "pet sise",
        "çekirdek",
        "cekirdek",
        "kabuk",
        "pislik",
    ],
    "Çalışma Ortamı": [
        "ofis",
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
        "pervane",
        "vantilatör",
        "vantilator",
        "kan ter",
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
        "mont",
        "parmak",
        "montaj",
        "hat",
        "klima",
        "havalandırma",
        "havalandirma",
        "gürültü",
        "gurultu",
        "aydınlatma",
        "aydinlatma",
        "masa",
        "sandalye",
        "ergonomi",
    ],
    "Öneri ve İyileştirme": [
        "öneri",
        "oneri",
        "öneriyorum",
        "oneriyorum",
        "iyileştirme",
        "iyilestirme",
        "geliştir",
        "gelistir",
        "faydalı olur",
        "faydali olur",
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
    ],
}

MULTI_TOPIC_LABEL = "Çoklu Konu"


@dataclass
class CategoryAlignmentResult:
    selected_category: str
    suggested_category: Optional[str]
    category_mismatch: bool
    needs_manual_review: bool
    reason: Optional[str]
    detected_categories: dict[str, int]


def normalize_message(message: str) -> str:
    lowered_message = message.lower().replace("i̇", "i")
    return " ".join(lowered_message.strip().split())


def clean_message_for_storage(message: str) -> str:
    return " ".join(message.strip().split())


def count_letters(message: str) -> int:
    return len(re.findall(r"[a-zA-ZçğıöşüÇĞİÖŞÜ]", message))


def count_digits(message: str) -> int:
    return len(re.findall(r"\d", message))


def count_non_text_characters(message: str) -> int:
    return len(re.findall(r"[^a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s.,!?;:()/%+-]", message))


def get_words(message: str) -> list[str]:
    return re.findall(r"[a-zA-ZçğıöşüÇĞİÖŞÜ0-9]+", normalize_message(message))


def get_repeated_phrase_count(words: list[str], phrase_length: int) -> int:
    if len(words) < phrase_length * 2:
        return 0

    phrases = [
        tuple(words[index : index + phrase_length])
        for index in range(0, len(words) - phrase_length + 1)
    ]
    phrase_counts = Counter(phrases)
    return phrase_counts.most_common(1)[0][1]


def count_vowels(message: str) -> int:
    normalized_message = normalize_message(message)
    return sum(1 for character in normalized_message if character in TURKISH_VOWELS)


def looks_like_random_character_sequence(message: str) -> bool:
    normalized_message = normalize_message(message)
    letter_count = count_letters(normalized_message)
    compact_message = re.sub(r"\s+", "", normalized_message)

    if letter_count < 6:
        return False

    vowel_ratio = count_vowels(normalized_message) / letter_count
    has_long_consonant_run = bool(
        re.search(r"[bcçdfgğhjklmnprsştvyzqxw]{6,}", normalized_message)
    )
    has_repeated_fragment = bool(re.fullmatch(r"(.{2,4})\1{1,}", compact_message))

    return vowel_ratio < 0.12 or has_long_consonant_run or has_repeated_fragment


def contains_forbidden_expression(message: str) -> bool:
    normalized_message = normalize_message(message)
    safe_message = normalized_message

    for safe_pattern in SAFE_FORBIDDEN_OVERLAP_PATTERNS:
        safe_message = re.sub(safe_pattern, " ", safe_message)

    return any(
        re.search(pattern, safe_message)
        for pattern in FORBIDDEN_PATTERNS
    ) or any(
        re.search(pattern, safe_message)
        for pattern in CONTEXTUAL_FORBIDDEN_PATTERNS
    )


def contains_suspicious_command(message: str) -> bool:
    normalized_message = normalize_message(message)

    return any(
        re.search(pattern, normalized_message, flags=re.IGNORECASE)
        for pattern in SUSPICIOUS_COMMAND_PATTERNS
    )


def validate_message_quality(message: str) -> str:
    clean_message = clean_message_for_storage(message)
    normalized_message = normalize_message(clean_message)
    words = get_words(clean_message)
    letter_count = count_letters(clean_message)
    digit_count = count_digits(clean_message)

    if len(normalized_message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı çok uzun. Lütfen 1000 karakteri geçmeyin.",
        )

    if letter_count < MIN_LETTER_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı anlamlı bir metin içermeli.",
        )

    if contains_suspicious_command(clean_message):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı komut veya kod ifadesi gibi görünüyor.",
        )

    if any(len(word) > MAX_SINGLE_TOKEN_LENGTH for word in words):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı geçersiz veya anlamsız karakter dizisi içeriyor.",
        )

    if looks_like_random_character_sequence(clean_message):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı anlamsız karakter dizisi gibi görünüyor.",
        )

    if re.search(r"(.)\1{7,}", normalized_message):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geri bildirim mesajı tekrar eden anlamsız karakterler içeriyor.",
        )

    if len(normalized_message) >= 20:
        digit_ratio = digit_count / len(normalized_message)
        if digit_ratio > 0.35:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geri bildirim mesajı çok fazla sayı içeriyor ve açıklayıcı metin gibi görünmüyor.",
            )

        non_text_ratio = count_non_text_characters(normalized_message) / len(normalized_message)
        if non_text_ratio > 0.35:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geri bildirim mesajı çok fazla özel karakter içeriyor.",
            )

    if len(words) >= 10:
        word_counts = Counter(words)
        most_common_count = word_counts.most_common(1)[0][1]
        unique_ratio = len(word_counts) / len(words)
        if most_common_count >= 6 or unique_ratio < 0.25:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geri bildirim mesajı tekrar eden anlamsız ifadeler içeriyor.",
            )

        if (
            get_repeated_phrase_count(words, phrase_length=3) >= 3
            or get_repeated_phrase_count(words, phrase_length=4) >= 3
            or get_repeated_phrase_count(words, phrase_length=5) >= 3
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geri bildirim mesajı aynı ifadeyi gereğinden fazla tekrar ediyor.",
            )

    return clean_message


def detect_message_categories(message: str) -> dict[str, int]:
    normalized_message = normalize_message(message)
    detected_categories = {}

    for category_name, keywords in CATEGORY_KEYWORDS.items():
        score = sum(
            1
            for keyword in keywords
            if keyword_matches_message(keyword, normalized_message)
        )
        if score > 0:
            detected_categories[category_name] = score

    return detected_categories


def keyword_matches_message(keyword: str, normalized_message: str) -> bool:
    normalized_keyword = normalize_message(keyword)

    if not normalized_keyword:
        return False

    if " " in normalized_keyword:
        return normalized_keyword in normalized_message

    message_words = get_words(normalized_message)

    if len(normalized_keyword) <= 3:
        return normalized_keyword in message_words

    return any(word.startswith(normalized_keyword) for word in message_words)


def analyze_feedback_category_alignment(
    message: str,
    selected_category_name: str,
) -> CategoryAlignmentResult:
    detected_categories = detect_message_categories(message)

    if not detected_categories:
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=None,
            category_mismatch=False,
            needs_manual_review=True,
            reason="Mesajın ana kategorisi net belirlenemedi.",
            detected_categories=detected_categories,
        )

    if selected_category_name == "Öneri ve İyileştirme":
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=selected_category_name,
            category_mismatch=False,
            needs_manual_review=False,
            reason=None,
            detected_categories=detected_categories,
        )

    if len(detected_categories) >= 2 and selected_category_name == "Diğer":
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=MULTI_TOPIC_LABEL,
            category_mismatch=False,
            needs_manual_review=True,
            reason="Mesaj birden fazla kategoriyle ilişkili görünüyor.",
            detected_categories=detected_categories,
        )

    if selected_category_name in detected_categories:
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=selected_category_name,
            category_mismatch=False,
            needs_manual_review=False,
            reason=None,
            detected_categories=detected_categories,
        )

    sorted_detected_categories = sorted(
        detected_categories.items(),
        key=lambda item: item[1],
        reverse=True,
    )
    best_category, best_score = sorted_detected_categories[0]
    second_best_score = (
        sorted_detected_categories[1][1]
        if len(sorted_detected_categories) > 1
        else 0
    )

    if selected_category_name == "Diğer":
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=best_category,
            category_mismatch=False,
            needs_manual_review=True,
            reason="Mesaj bilinen bir kategoriyle ilişkili görünüyor.",
            detected_categories=detected_categories,
        )

    if (
        (len(sorted_detected_categories) == 1 and best_score >= 1)
        or (best_score >= 2 and best_score > second_best_score)
    ):
        return CategoryAlignmentResult(
            selected_category=selected_category_name,
            suggested_category=best_category,
            category_mismatch=True,
            needs_manual_review=False,
            reason=f"Mesaj {best_category} kategorisine daha uygun görünüyor.",
            detected_categories=detected_categories,
        )

    return CategoryAlignmentResult(
        selected_category=selected_category_name,
        suggested_category=None,
        category_mismatch=False,
        needs_manual_review=True,
        reason="Mesajın ana kategorisi düşük güvenle belirlenebildi.",
        detected_categories=detected_categories,
    )


def validate_feedback_category_match(message: str, selected_category_name: str) -> None:
    alignment_result = analyze_feedback_category_alignment(
        message=message,
        selected_category_name=selected_category_name,
    )

    if not alignment_result.category_mismatch:
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Mesaj içeriği seçilen kategoriyle uyumlu görünmüyor. "
            f"Önerilen kategori: {alignment_result.suggested_category}."
        ),
    )


def validate_feedback_message_content(message: str) -> str:
    normalized_message = validate_message_quality(message)

    if contains_forbidden_expression(message):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=FORBIDDEN_MESSAGE,
        )

    return normalized_message
