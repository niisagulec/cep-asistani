from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
import unicodedata

import joblib

from app.services.content_filter_service import normalize_message


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = BASE_DIR / "ml" / "models" / "feedback_detail_model.joblib"
MODEL_PATH = Path(os.getenv("FEEDBACK_DETAIL_MODEL_PATH", DEFAULT_MODEL_PATH))

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

ALLOWED_DETAILS_BY_CATEGORY = {
    "Yemekhane": {
        "Ekipman/Fiziksel Alan",
        "Hijyen/Temizlik",
        "Menü Çeşitliliği",
        "Personel Davranışı",
        "Sıra/Kalabalık",
        "Yemek Kalitesi",
    },
    "Servis": {
        "Araç Konforu",
        "Güvenlik/Risk",
        "Güzergah/Durak",
        "Saat/Gecikme",
        "Şoför Davranışı",
    },
    "Ortak Alan": {
        "Asansör/Merdiven",
        "Dinlenme Alanı",
        "Fiziksel Düzen",
        "Hijyen/Temizlik",
        "Otopark",
        "Toplantı Odası",
        "Tuvalet/Sarf Malzeme",
    },
    "Teknik Destek": {
        "Donanım Sorunu",
        "Erişim/Yetki Sorunu",
        "Sistem Performansı",
        "Yazılım Sorunu",
        "İnternet/Ağ Sorunu",
    },
    "İK / Personel İşleri": {
        "Eğitim/Gelişim",
        "Maaş/Yan Haklar",
        "Personel Davranışı",
        "İletişim/Bilgilendirme",
        "İzin/Süreç Bilgilendirme",
    },
    "Güvenlik": {
        "Acil Durum/Ekipman",
        "Fiziksel Risk",
        "Giriş-Çıkış/Güvenlik Kontrolü",
        "İş Güvenliği Riski",
        "Personel Davranışı",
    },
    "Çalışma Ortamı": {
        "Alan Yetersizliği",
        "Aydınlatma",
        "Ergonomi",
        "Gürültü",
        "Isıtma/Soğutma",
    },
    "Öneri ve İyileştirme": {
        "Sosyal Etkinlik",
        "Süreç İyileştirme",
        "Teknolojik İyileştirme",
        "Çalışan Deneyimi",
    },
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
    "frenlerinden",
    "fren arız",
    "fren ariz",
    "fren tutm",
    "frenleri tutm",
    "fren çalışm",
    "fren calism",
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
    "kapı kapanmadan",
    "kapi kapanmadan",
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
    "hareket halindeyken mesaj",
    "dişim kır",
    "disim kir",
    "şifreleri ele geçiril",
    "sifreleri ele geciril",
    "yetkilerimiz iptal",
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
    "hareket halindeyken",
    "mesaj yaz",
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
    "yolcularla kavga",
    "kavga ediyor",
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
    "tartış",
    "tartis",
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
    "açık kablo",
    "acik kablo",
    "çıplak kablo",
    "ciplak kablo",
    "kabloda kaçak",
    "kabloda kacak",
    "kablodan akım",
    "kablodan akim",
    "priz",
    "kaynak",
    "kaynak makinesi",
    "ark yap",
    "ark yapıyor",
    "ark yapiyor",
    "statik",
    "akım",
    "akim",
    "kablo aşın",
    "kablo asin",
    "kablolarda aşın",
    "kablolarda asin",
    "kablolardaki aşın",
    "kablolardaki asin",
    "aşınmış kablo",
    "asinmis kablo",
    "yıpran",
    "yipran",
    "soyul",
    "çarp",
    "carp",
    "kaçak",
    "kacak",
    "elektrik yükü",
    "elektrik yuku",
    "aşırı yük",
    "asiri yuk",
    "kıvılcım",
    "kivilcim",
    "dokunmaya kork",
    "tüyleri diken",
    "tuyleri diken",
]

CABLE_WEAR_RISK_KEYWORDS = [
    "kablo aşın",
    "kablo asin",
    "kablolarda aşın",
    "kablolarda asin",
    "kablolardaki aşın",
    "kablolardaki asin",
    "aşınmış kablo",
    "asinmis kablo",
    "yıpranmış kablo",
    "yipranmis kablo",
]

RISKY_DRIVING_DETAIL_KEYWORDS = [
    "aşırı hızlı",
    "asiri hizli",
    "tehlikeli kullan",
    "kırmızı ışık",
    "kirmizi isik",
    "sert fren",
    "ani fren",
    "seyir halindeyken",
    "telefonla video",
    "telefonla oyn",
    "kapı kapanmadan",
    "kapi kapanmadan",
    "fren",
    "durmakta zorlan",
]

VEHICLE_MECHANICAL_RISK_KEYWORDS = [
    "kapı kapanmadan",
    "kapi kapanmadan",
    "kapısı tam kapanm",
    "kapisi tam kapanm",
    "otomatik kapı",
    "otomatik kapi",
    "frenlerinden",
    "fren arız",
    "fren ariz",
    "fren tutm",
    "frenleri tutm",
    "fren çalışm",
    "fren calism",
    "durmakta zorlan",
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

CAFETERIA_QUEUE_KEYWORDS = [
    "sırada bekle",
    "sirada bekle",
    "yemek sırası",
    "yemek sirasi",
    "dağıtım servisi",
    "dagitim servisi",
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
    "hediye çeki",
    "hediye ceki",
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
    "etiket yazısı",
    "etiket yazisi",
    "ürün yazısı",
    "urun yazisi",
]

TECHNICAL_SOFTWARE_KEYWORDS = [
    "uygulama",
    "uygulamada",
    "uygda",
    "mobil uygulama",
    "yazılım",
    "yazilim",
    "excel",
    "erp",
    "sürücü",
    "surucu",
    "bildirim",
    "geribildirim",
    "geri bildirim",
    "buton",
    "menü",
    "menu",
    "sayfa",
    "panel",
]

TECHNICAL_ACCESS_KEYWORDS = [
    "erişim",
    "erisim",
    "yetkim yok",
    "yetkim bulunmuyor",
    "yetki yok",
    "giriş yapamıyorum",
    "giris yapamiyorum",
    "hesabım açılmıyor",
    "hesabim acilmiyor",
    "şifre sıfırla",
    "sifre sifirla",
    "e postama giremiyorum",
    "e-postama giremiyorum",
    "epostama giremiyorum",
    "onay kodu gelm",
    "aktivasyon kodu gelm",
    "sms kodu gelm",
    "kullanıcı adı",
    "kullanici adi",
    "şifre eşleşm",
    "sifre eslesm",
    "hesap kilit",
    "kilitlendi",
]

TECHNICAL_NETWORK_KEYWORDS = [
    "internet",
    "wifi",
    "wi-fi",
    "ağ bağlantısı",
    "ag baglantisi",
]

TECHNICAL_PERFORMANCE_KEYWORDS = [
    "yavaş",
    "yavas",
    "donuyor",
    "dondu",
    "geç cevap",
    "gec cevap",
    "takılıyor",
    "takiliyor",
    "dakikalarca bekle",
    "geç açıl",
    "gec acil",
]

TECHNICAL_HARDWARE_KEYWORDS = [
    "monitör",
    "monitor",
    "görüntü gelm",
    "goruntu gelm",
    "displayport",
    "hdmi",
    "kulaklık",
    "kulaklik",
    "mikrofon",
    "cızırtı",
    "cizirti",
    "mouse",
    "fare",
    "klavye",
    "usb",
    "temassızlık",
    "temassizlik",
]

TECHNICAL_DRIVER_SOFTWARE_KEYWORDS = [
    "klavye sürücüsü",
    "klavye surucusu",
    "sürücü kur",
    "surucu kur",
    "driver kur",
]

WORKPLACE_NOISE_KEYWORDS = [
    "gürültü",
    "gurultu",
    "makine sesi",
    "ses yüzünden",
    "ses yuzunden",
    "yüksek ses",
    "yuksek ses",
    "uğultu",
    "ugultu",
]

HR_LEAVE_PROCESS_KEYWORDS = [
    "izin talep",
    "izin süreci",
    "izin sureci",
    "yıllık izin",
    "yillik izin",
    "rapor izni",
    "izin sonucu",
    "izin isteğ",
    "izin isteg",
    "izin redd",
    "evlilik izni",
    "doğum izni",
    "dogum izni",
    "babalık izni",
    "babalik izni",
    "mazeret izni",
    "ücretsiz izin",
    "ucretsiz izin",
    "izin hak",
    "belge yükle",
    "belge yukle",
]

CAFETERIA_MENU_VARIETY_KEYWORDS = [
    "hep aynı",
    "hep ayni",
    "daha fazla çeşit",
    "daha fazla cesit",
    "salata bar",
]

SHUTTLE_DELAY_KEYWORDS = [
    "geç kald",
    "gec kal",
    "dakikadır",
    "dakikadir",
    "gelmedi",
    "gecikti",
]

SAFETY_PPE_KEYWORDS = [
    "baret",
    "koruyucu ekipman",
    "iş ayakkabısı",
    "is ayakkabisi",
]

HR_COMMUNICATION_KEYWORDS = [
    "son dakika bildir",
    "geç bildir",
    "gec bildir",
    "bilgi verilmeden",
    "haber verilmeden",
]

PHYSICAL_FALL_RISK_KEYWORDS = [
    "biri düşebilir",
    "biri dusebilir",
    "kayma tehlikesi",
    "ıslak zemin",
    "islak zemin",
    "devrilecek",
    "çıkış kapısının önüne",
    "cikis kapisinin onune",
    "kapının önüne palet",
    "kapinin onune palet",
    "yolu kapatılmış",
    "yolu kapatilmis",
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

WORKPLACE_CAPACITY_KEYWORDS = [
    "yer kalmadı",
    "yer kalmadi",
    "geçecek yer",
    "gececek yer",
    "sığmıyor",
    "sigmiyor",
    "kişi çalışıyoruz",
    "kisi calisiyoruz",
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
    "wifi",
    "wi-fi",
    "kablosuz internet",
]

CAFETERIA_FOREIGN_OBJECT_KEYWORDS = [
    "kıl",
    "kil",
    "metal parça",
    "metal parca",
    "yabancı madde",
    "yabanci madde",
    "cam parça",
    "cam parca",
    "kesici parça",
    "kesici parca",
    "taş gibi sert",
    "tas gibi sert",
    "sert parça",
    "sert parca",
]

CAFETERIA_EQUIPMENT_KEYWORDS = [
    "havalandırma",
    "havalandirma",
    "gaz kokusu",
    "patlama riski",
    "atıştırmalık köşesi",
    "atistirmalik kosesi",
    "meyve köşesi",
    "meyve kosesi",
]

CAFETERIA_POISONING_KEYWORDS = [
    "zehirlenme",
    "zehirlendi",
    "yemekten sonra hastalan",
]

CAFETERIA_PERSONNEL_INCIDENT_KEYWORDS = [
    "personel çalışanlara",
    "personel calisanlara",
    "fiziksel saldır",
    "fiziksel saldir",
]

SHUTTLE_TRACKING_KEYWORDS = [
    "aracın nerede",
    "aracin nerede",
    "araçların nerede",
    "araclarin nerede",
    "anlık takip",
    "anlik takip",
    "canlı konum",
    "canli konum",
    "nerede olduğunu",
    "nerede oldugunu",
]

SHUTTLE_ROUTE_PLANNING_KEYWORDS = [
    "trafiği azalt",
    "trafigi azalt",
    "çıkış saatlerini erkene",
    "cikis saatlerini erkene",
    "trafiğ",
    "trafig",
    "erkene alın",
    "erkene alin",
]


def is_workplace_temperature_message(category_name: str, message: str) -> bool:
    return category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_TEMPERATURE_KEYWORDS,
    )


def is_shuttle_route_message(message: str) -> bool:
    has_vehicle_context = contains_any_keyword(
        message,
        SHUTTLE_DRIVER_CONTEXT_KEYWORDS + ["araç", "arac", "servis"],
    )
    return has_vehicle_context and contains_any_keyword(message, SHUTTLE_ROUTE_KEYWORDS)

CRITICAL_HYGIENE_KEYWORDS = [
    "çöp",
    "cop",
    "taşmış",
    "tasmis",
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
    "olsa güzel",
    "olsa guzel",
    "iyi olur",
    "sunulabilir",
    "getirilebilir",
    "birleştirilebilir",
    "birlestirilebilir",
    "dijitalleştirilirse",
    "dijitallestirilirse",
    "düzenlenebilir",
    "duzenlenebilir",
    "konulabilir",
    "kaldırılabilir",
    "kaldirilabilir",
    "geliştirilebilir",
    "gelistirilebilir",
    "yapılması",
    "yapilmasi",
    "mutlu eder",
    "faydalı olacaktır",
    "faydali olacaktir",
    "eklenmesi",
    "oluşturulması",
    "olusturulmasi",
    "hayata geçirilebilir",
    "hayata gecirilebilir",
    "güzel bir gelişim",
    "guzel bir gelisim",
    "test edilmesini rica",
    "yükseltir",
    "yukseltir",
    "iyi olacaktır",
    "iyi olacaktir",
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
    return f"Kategori: {category_name} | Mesaj: {normalize_message(message)}"


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
    if category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_NOISE_KEYWORDS,
    ):
        return 3

    if category_name == "Güvenlik" and contains_any_keyword(
        message,
        PHYSICAL_FALL_RISK_KEYWORDS,
    ):
        return 5

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
    message = normalize_message(message)

    if category_name == "Servis" and contains_any_keyword(
        message,
        VEHICLE_MECHANICAL_RISK_KEYWORDS,
    ):
        return "Güvenlik/Risk", adjusted_rule_confidence(
            nlp_detail,
            "Güvenlik/Risk",
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_MENU_VARIETY_KEYWORDS,
    ):
        return "Menü Çeşitliliği", adjusted_rule_confidence(
            nlp_detail,
            "Menü Çeşitliliği",
            prediction_confidence,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_QUEUE_KEYWORDS,
    ):
        return "Sıra/Kalabalık", adjusted_rule_confidence(
            nlp_detail,
            "Sıra/Kalabalık",
            prediction_confidence,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_FOREIGN_OBJECT_KEYWORDS,
    ):
        return "Hijyen/Temizlik", adjusted_rule_confidence(
            nlp_detail,
            "Hijyen/Temizlik",
            prediction_confidence,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_EQUIPMENT_KEYWORDS,
    ):
        return "Ekipman/Fiziksel Alan", adjusted_rule_confidence(
            nlp_detail,
            "Ekipman/Fiziksel Alan",
            prediction_confidence,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_POISONING_KEYWORDS,
    ):
        return "Yemek Kalitesi", adjusted_rule_confidence(
            nlp_detail,
            "Yemek Kalitesi",
            prediction_confidence,
        )

    if category_name == "Yemekhane" and contains_any_keyword(
        message,
        CAFETERIA_PERSONNEL_INCIDENT_KEYWORDS,
    ):
        return "Personel Davranışı", adjusted_rule_confidence(
            nlp_detail,
            "Personel Davranışı",
            prediction_confidence,
        )

    if (
        category_name == "Servis"
        and contains_any_keyword(message, RISKY_DRIVING_DETAIL_KEYWORDS)
    ):
        override_detail = (
            "Güvenlik/Risk"
            if contains_any_keyword(message, VEHICLE_MECHANICAL_RISK_KEYWORDS)
            else "Şoför Davranışı"
        )
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if category_name == "Servis" and contains_any_keyword(
        message,
        SHUTTLE_TRACKING_KEYWORDS,
    ):
        return "Saat/Gecikme", adjusted_rule_confidence(
            nlp_detail,
            "Saat/Gecikme",
            prediction_confidence,
        )

    if category_name == "Servis" and contains_any_keyword(
        message,
        SHUTTLE_DELAY_KEYWORDS,
    ):
        return "Saat/Gecikme", adjusted_rule_confidence(
            nlp_detail,
            "Saat/Gecikme",
            prediction_confidence,
        )

    if category_name == "Servis" and contains_any_keyword(
        message,
        SHUTTLE_ROUTE_PLANNING_KEYWORDS,
    ):
        return "Güzergah/Durak", adjusted_rule_confidence(
            nlp_detail,
            "Güzergah/Durak",
            prediction_confidence,
        )

    if category_name == "Servis" and contains_any_keyword(
        message,
        SHUTTLE_COMFORT_KEYWORDS,
    ):
        return "Araç Konforu", adjusted_rule_confidence(
            nlp_detail,
            "Araç Konforu",
            prediction_confidence,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        CABLE_WEAR_RISK_KEYWORDS,
    ):
        return "Güvenlik/Risk", adjusted_rule_confidence(
            nlp_detail,
            "Güvenlik/Risk",
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        ELECTRICAL_RISK_KEYWORDS,
    ):
        return "Donanım Sorunu", adjusted_rule_confidence(
            nlp_detail,
            "Donanım Sorunu",
            prediction_confidence,
            floor=0.70,
            cap=0.82,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        TECHNICAL_ACCESS_KEYWORDS,
    ):
        override_detail = "Erişim/Yetki Sorunu"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if (
        category_name == "Teknik Destek"
        and nlp_detail == "İnternet/Ağ Sorunu"
        and contains_any_keyword(message, TECHNICAL_NETWORK_KEYWORDS)
    ):
        return nlp_detail, prediction_confidence

    if (
        category_name == "Teknik Destek"
        and nlp_detail != "İnternet/Ağ Sorunu"
        and contains_any_keyword(message, TECHNICAL_PERFORMANCE_KEYWORDS)
    ):
        override_detail = "Sistem Performansı"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        TECHNICAL_DRIVER_SOFTWARE_KEYWORDS,
    ):
        return "Yazılım Sorunu", adjusted_rule_confidence(
            nlp_detail,
            "Yazılım Sorunu",
            prediction_confidence,
            floor=0.72,
            cap=0.84,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        TECHNICAL_HARDWARE_KEYWORDS,
    ):
        override_detail = "Donanım Sorunu"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Teknik Destek" and contains_any_keyword(
        message,
        TECHNICAL_SOFTWARE_KEYWORDS,
    ):
        override_detail = "Yazılım Sorunu"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
            floor=0.72,
            cap=0.84,
        )

    if category_name == "İK / Personel İşleri" and contains_any_keyword(
        message,
        HR_LEAVE_PROCESS_KEYWORDS,
    ):
        override_detail = "İzin/Süreç Bilgilendirme"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "İK / Personel İşleri" and contains_any_keyword(
        message,
        HR_COMMUNICATION_KEYWORDS,
    ):
        override_detail = "İletişim/Bilgilendirme"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Çalışma Ortamı" and contains_any_keyword(
        message,
        WORKPLACE_NOISE_KEYWORDS,
    ):
        override_detail = "Gürültü"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Ortak Alan" and contains_any_keyword(
        message,
        COMMON_AREA_SUPPLY_KEYWORDS,
    ):
        override_detail = "Tuvalet/Sarf Malzeme"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

    if category_name == "Güvenlik" and contains_any_keyword(
        message,
        PHYSICAL_FALL_RISK_KEYWORDS,
    ):
        override_detail = "Fiziksel Risk"
        return override_detail, adjusted_rule_confidence(
            nlp_detail,
            override_detail,
            prediction_confidence,
        )

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

    if category_name == "Güvenlik" and contains_any_keyword(
        message,
        SAFETY_PPE_KEYWORDS,
    ):
        return "İş Güvenliği Riski", adjusted_rule_confidence(
            nlp_detail,
            "İş Güvenliği Riski",
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

    if (
        category_name == "Çalışma Ortamı"
        and not contains_any_keyword(message, WORKPLACE_CAPACITY_KEYWORDS)
        and contains_any_keyword(message, WORKPLACE_ERGONOMY_KEYWORDS)
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
        and prediction_confidence < 0.62
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

    model_bundle = load_feedback_detail_model()
    if model_bundle is None:
        return DEFAULT_DETAIL_BY_CATEGORY.get(category_name, "Genel Bildirim"), 0.35

    if isinstance(model_bundle, dict):
        model = model_bundle.get(category_name)
        if model is None:
            return DEFAULT_DETAIL_BY_CATEGORY.get(category_name, "Genel Bildirim"), 0.35
    else:
        model = model_bundle

    model_input = build_model_input(category_name=category_name, message=message)
    prediction = model.predict([model_input])[0]

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba([model_input])[0]
        model_classes = [str(model_class) for model_class in model.classes_]
        allowed_details = ALLOWED_DETAILS_BY_CATEGORY.get(category_name)

        if allowed_details:
            allowed_candidates = [
                (model_class, float(probabilities[class_index]))
                for class_index, model_class in enumerate(model_classes)
                if model_class in allowed_details
            ]
            if allowed_candidates:
                prediction, confidence = max(
                    allowed_candidates,
                    key=lambda candidate: candidate[1],
                )
            else:
                confidence = float(max(probabilities))
        else:
            confidence = float(max(probabilities))
    else:
        confidence = 0.0

    return str(prediction), confidence


def analyze_feedback_message(message: str, category_name: str) -> FeedbackAnalysisResult:
    model_detail, model_confidence = predict_feedback_detail(
        category_name=category_name,
        message=message,
    )
    nlp_detail, prediction_confidence = apply_rule_based_overrides(
        category_name=category_name,
        message=message,
        nlp_detail=model_detail,
        prediction_confidence=model_confidence,
    )
    allowed_details = ALLOWED_DETAILS_BY_CATEGORY.get(category_name)
    if allowed_details and nlp_detail not in allowed_details:
        nlp_detail = model_detail
        prediction_confidence = model_confidence

    message_priority_score = calculate_message_priority_score(message, category_name)

    return FeedbackAnalysisResult(
        nlp_detail=nlp_detail,
        prediction_confidence=prediction_confidence,
        message_priority_score=message_priority_score,
    )
