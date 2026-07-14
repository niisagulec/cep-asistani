import json
import random
from collections import Counter
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BACKEND_DIR / "app" / "data" / "feedback_training_dataset.json"
DEFAULT_TARGET_COUNT_PER_DETAIL = 100
RANDOM_SEED = 42


TARGET_COUNT_BY_DETAIL = {
    # Modelin son değerlendirmelerinde daha çok karışan / düşük kalan sınıflar.
    # Bu sınıfları artırarak modelin genelleme gücünü iyileştirmeyi hedefliyoruz.
    "Donanım Sorunu": 140,
    "Hijyen/Temizlik": 140,
    "Ekipman/Fiziksel Alan": 140,
    "Yemek Kalitesi": 140,
    "Şoför Davranışı": 140,
}


TONE_CONFIG = [
    ("ACIL_TEHLIKE", 5, 4),
    ("STANDART_SIKAYET", 3, 10),
    ("DILEK_ONERI", 2, 6),
]

OPENERS = [
    "",
    "Son günlerde ",
    "Bu hafta ",
    "Özellikle yoğun saatlerde ",
    "Birkaç gündür ",
]

CLOSERS = {
    "ACIL_TEHLIKE": [
        "Acil değerlendirilmesini rica ederim.",
        "Bu konuya hızlıca müdahale edilmeli.",
        "Güvenlik açısından bekletilmemesi gerekiyor.",
        "Lütfen öncelikli olarak incelensin.",
    ],
    "STANDART_SIKAYET": [
        "Düzeltilirse günlük akışımız rahatlar.",
        "Bu konuda destek bekliyoruz.",
        "Kontrol edilmesini rica ederim.",
        "Düzenli hale getirilmesi iyi olur.",
    ],
    "DILEK_ONERI": [
        "Bu iyileştirme çalışan deneyimini artırır.",
        "Bu düzenleme süreci daha verimli hale getirir.",
        "Böyle bir uygulama faydalı olabilir.",
        "Değerlendirilmesini rica ederim.",
    ],
}


NOISE_SUFFIXES = [
    "ya",
    "lütfen bakar mısınız",
    "bu konu gerçekten yoruyor",
    "bir süredir aynı durum var",
    "artık çözülmesini rica ediyoruz",
    "ekipçe zorlanıyoruz",
    "mümkünse hızlıca bakılsın",
    "tekrar tekrar yaşanıyor",
]

INFORMAL_REPLACEMENTS = {
    "arıza veriyor": ["bozuluyor", "cortluyor", "sürekli sorun çıkarıyor"],
    "düzgün çalışmıyor": ["çalışmıyo", "tam çalışmıyor", "bir çalışıp bir duruyor"],
    "çok yavaş çalışıyor": ["aşırı yavaş", "kağnı gibi ilerliyor", "çok kasıyor"],
    "sık sık donuyor": ["habire donuyor", "ekran takılı kalıyor", "sürekli kilitleniyor"],
    "hata veriyor": ["hata fırlatıyor", "uyarı verip duruyor", "işlem almıyor"],
    "geç geliyor": ["geç kalıyor", "zamanında gelmiyor", "yine sarkıyor"],
    "çok hızlı kullanılıyor": ["fazla hızlı gidiyor", "çok sert kullanılıyor", "hızını alamıyor gibi"],
    "yeterince temiz görünmüyor": ["temiz durmuyor", "kirli gibi duruyor", "içimize sinmiyor"],
    "soğuk servis ediliyor": ["buz gibi geliyor", "sıcak gelmiyor", "soğumuş oluyor"],
}

TYPO_REPLACEMENTS = {
    "çalışmıyor": "çalışmıyo",
    "geliyor": "geliyo",
    "olmuyor": "olmuyo",
    "ediyorum": "ediyom",
    "değerlendirilmesini": "değerlendirilmesini",
    "lütfen": "lutfen",
    "sürekli": "surekli",
}


EDGE_CASES = {
    ("Yemekhane", "Yemek Kalitesi"): [
        ("STANDART_SIKAYET", 3, "Yemek bugün buz gibiydi, yiyemedik."),
        ("STANDART_SIKAYET", 3, "Çorba su gibi olmuş, lezzet hiç yok."),
        ("ACIL_TEHLIKE", 5, "Tavuk pişmemiş gibiydi, gıda zehirlenmesi olabilir."),
        ("DILEK_ONERI", 2, "Yemeklerin sıcaklık kontrolü yapılsa iyi olur."),
        ("STANDART_SIKAYET", 3, "Porsiyonlar çok az, öğleden sonra aç kalıyoruz."),
    ],
    ("Yemekhane", "Hijyen/Temizlik"): [
        ("STANDART_SIKAYET", 3, "Tabakta leke vardı, içime sinmedi."),
        ("STANDART_SIKAYET", 3, "Masalar silinmeden yeni kişiler oturuyor."),
        ("ACIL_TEHLIKE", 5, "Salata bölümünde kötü koku var, hijyen açısından riskli."),
        ("DILEK_ONERI", 2, "Yoğun saatlerde temizlik kontrolü artırılabilir."),
        ("STANDART_SIKAYET", 3, "Çatal bıçaklar temiz görünmüyor ya."),
    ],
    ("Yemekhane", "Ekipman/Fiziksel Alan"): [
        ("STANDART_SIKAYET", 3, "Yemekhanedeki ocak yine cortladı gibi, sıra aksıyor."),
        ("STANDART_SIKAYET", 3, "Havalandırma yok gibi, içerisi çok ağır kokuyor."),
        ("ACIL_TEHLIKE", 5, "Su sebilinin kablosu açıkta duruyor, tehlikeli olabilir."),
        ("DILEK_ONERI", 2, "Oturma alanı biraz daha mantıklı düzenlenebilir."),
        ("STANDART_SIKAYET", 3, "Masa düzeni çok sıkışık, geçmek zor oluyor."),
    ],
    ("Yemekhane", "Menü Çeşitliliği"): [
        ("STANDART_SIKAYET", 3, "Menü dönüp dolaşıp aynı yere geliyor."),
        ("STANDART_SIKAYET", 3, "Her hafta benzer yemekler çıkıyor, sıkıldık artık."),
        ("DILEK_ONERI", 2, "Vejetaryen seçenek olsa çok iyi olur."),
        ("DILEK_ONERI", 2, "Menüye daha hafif alternatifler eklenebilir."),
        ("STANDART_SIKAYET", 3, "Sağlıklı seçenek neredeyse hiç yok."),
    ],
    ("Yemekhane", "Sıra/Kalabalık"): [
        ("STANDART_SIKAYET", 3, "Yemek sırası bitmiyor, mola kuyrukta geçiyor."),
        ("STANDART_SIKAYET", 3, "Oturacak yer bulmak ayrı dert oldu."),
        ("DILEK_ONERI", 2, "Yemek saatleri departmanlara göre bölünebilir."),
        ("STANDART_SIKAYET", 3, "Tepsi alma yeri kilitleniyor, kimse ilerleyemiyor."),
        ("STANDART_SIKAYET", 3, "Öğlen yemekhane tam keşmekeş oluyor."),
    ],
    ("Yemekhane", "Personel Davranışı"): [
        ("STANDART_SIKAYET", 3, "Yemek dağıtan görevli çok ters konuştu."),
        ("STANDART_SIKAYET", 3, "Personel soru sorunca geçiştiriyor."),
        ("DILEK_ONERI", 2, "Yemekhane personeline iletişim eğitimi verilebilir."),
        ("STANDART_SIKAYET", 3, "Servis sırasında acele ettiriliyor, hoş olmuyor."),
        ("STANDART_SIKAYET", 3, "Kasa tarafındaki yaklaşım biraz kaba."),
    ],
    ("Servis", "Saat/Gecikme"): [
        ("STANDART_SIKAYET", 3, "Servis yine geç kaldı, şaşırtmadı."),
        ("STANDART_SIKAYET", 3, "Sabah servis yok gibi bekledik durduk."),
        ("DILEK_ONERI", 2, "Gecikme olunca uygulamadan bildirim gelebilir."),
        ("STANDART_SIKAYET", 3, "Akşam kalkış saati sürekli sarkıyor."),
        ("STANDART_SIKAYET", 3, "Durakta 25 dakika bekledik ya."),
    ],
    ("Servis", "Güzergah/Durak"): [
        ("STANDART_SIKAYET", 3, "Servis gereksiz dolanıyor, yol çok uzuyor."),
        ("STANDART_SIKAYET", 3, "Durak yeri net değil, herkes farklı yerde bekliyor."),
        ("DILEK_ONERI", 2, "Durak listesi uygulamada açıkça görünse iyi olur."),
        ("STANDART_SIKAYET", 3, "15-A hattı bizim durağı bazen pas geçiyor."),
        ("STANDART_SIKAYET", 3, "Güzergah değişti mi belli değil, karışıklık oluyor."),
    ],
    ("Servis", "Araç Konforu"): [
        ("STANDART_SIKAYET", 3, "Serviste klima gitti, içerisi fırın gibi."),
        ("STANDART_SIKAYET", 3, "Koltuklar çok rahatsız, yol bitmiyor."),
        ("ACIL_TEHLIKE", 5, "Emniyet kemeri çalışmıyor, bu riskli."),
        ("DILEK_ONERI", 2, "Araç içi temizlik daha düzenli yapılabilir."),
        ("STANDART_SIKAYET", 3, "Servis içinde ağır bir koku var."),
    ],
    ("Servis", "Şoför Davranışı"): [
        ("STANDART_SIKAYET", 3, "Şoför soru sorunca ters cevap veriyor."),
        ("STANDART_SIKAYET", 3, "Sürücü durakta bekleyenlere çok aceleci davranıyor."),
        ("ACIL_TEHLIKE", 5, "Şoför sinirli şekilde araç kullanıyor, tedirgin olduk."),
        ("DILEK_ONERI", 2, "Şoförlere yolcu iletişimi eğitimi verilebilir."),
        ("STANDART_SIKAYET", 3, "Şoförün tavrı çalışanları geriyor."),
    ],
    ("Servis", "Güvenlik/Risk"): [
        ("ACIL_TEHLIKE", 5, "Servis kırmızı ışıkta geçti, ciddi tehlike atlattık."),
        ("ACIL_TEHLIKE", 5, "Araç çok sert fren yaptı, düşenler oldu."),
        ("ACIL_TEHLIKE", 5, "Kapı tam kapanmadan hareket edildi."),
        ("STANDART_SIKAYET", 3, "Servis virajlarda fazla hızlı giriyor."),
        ("DILEK_ONERI", 2, "Riskli sürüşler için takip sistemi kurulabilir."),
    ],
    ("Teknik Destek", "Donanım Sorunu"): [
        ("STANDART_SIKAYET", 3, "Yazıcı kağıdı yutuyor, çıktı alamıyoruz."),
        ("STANDART_SIKAYET", 3, "Laptop yine kapandı, iş yarım kaldı."),
        ("ACIL_TEHLIKE", 5, "Prizden kıvılcım geldi, cihazı kapattım."),
        ("DILEK_ONERI", 2, "Eski bilgisayarlar için yenileme planı yapılabilir."),
        ("STANDART_SIKAYET", 3, "Klavye bazı tuşları basmıyor."),
    ],
    ("Teknik Destek", "Yazılım Sorunu"): [
        ("STANDART_SIKAYET", 3, "Program kayıt ekranında patlıyor."),
        ("STANDART_SIKAYET", 3, "ERP işlem yaparken hata fırlatıyor."),
        ("ACIL_TEHLIKE", 5, "Sistem kritik kaydı yanlış gösteriyor, işlem durdu."),
        ("DILEK_ONERI", 2, "Hata bildirim ekranı daha anlaşılır olabilir."),
        ("STANDART_SIKAYET", 3, "Uygulama açılıyor sonra kendi kendine kapanıyor."),
    ],
    ("Teknik Destek", "İnternet/Ağ Sorunu"): [
        ("STANDART_SIKAYET", 3, "VPN gitti, sisteme giremiyoruz."),
        ("STANDART_SIKAYET", 3, "Wifi toplantının ortasında koptu."),
        ("ACIL_TEHLIKE", 5, "Ağ tamamen çöktü, üretim ekranlarına erişemiyoruz."),
        ("DILEK_ONERI", 2, "Toplantı odaları için daha güçlü wifi kurulabilir."),
        ("STANDART_SIKAYET", 3, "İnternet bugün kağnı gibi."),
    ],
    ("Teknik Destek", "Erişim/Yetki Sorunu"): [
        ("STANDART_SIKAYET", 3, "Yetkim yok diye dosyayı açamıyorum."),
        ("STANDART_SIKAYET", 3, "Şifre sıfırlama çalışmıyo, giriş yapamadım."),
        ("ACIL_TEHLIKE", 5, "Acil rapora erişemiyorum, teslimat bekliyor."),
        ("DILEK_ONERI", 2, "Yetki talepleri uygulamadan takip edilebilir."),
        ("STANDART_SIKAYET", 3, "Ortak klasör yine erişim hatası verdi."),
    ],
    ("Teknik Destek", "Sistem Performansı"): [
        ("STANDART_SIKAYET", 3, "Sistem sabah resmen dondu kaldı."),
        ("STANDART_SIKAYET", 3, "Rapor ekranı çok kasıyor."),
        ("ACIL_TEHLIKE", 5, "Sunucu cevap vermiyor, kritik işler durdu."),
        ("DILEK_ONERI", 2, "Yoğun saatler için performans iyileştirmesi yapılabilir."),
        ("STANDART_SIKAYET", 3, "Bilgisayar açılana kadar kahve molası bitiyor."),
    ],
    ("Ortak Alan", "Dinlenme Alanı"): [
        ("DILEK_ONERI", 2, "Bahçeye bir iki tane daha bank eklesek iyi olur."),
        ("DILEK_ONERI", 2, "Çay ocağının yanına bir su sebili konulması çok iyi olur."),
        ("DILEK_ONERI", 2, "Bahçedeki çardağın yanına yeni banklar eklensin bence."),
        ("DILEK_ONERI", 2, "Çay ocağına su sebili koysak çok iyi olur sıcakta su iyi gider."),
        ("DILEK_ONERI", 2, "Bahçeye ek banklar konulması çalışan deneyimini artırır."),
    ],
}



TEMPLATES = {
    ("Yemekhane", "Yemek Kalitesi"): {
        "subjects": [
            "öğle yemeği",
            "ana yemek",
            "çorba",
            "salata barı",
            "servis edilen tavuk",
            "yemek porsiyonu",
        ],
        "problems": [
            "soğuk servis ediliyor",
            "tadı bozuk gibi geliyor",
            "tam pişmemiş görünüyor",
            "çok yağlı ve ağır hazırlanıyor",
            "porsiyon olarak yetersiz kalıyor",
            "tazeliğini kaybetmiş gibi duruyor",
        ],
        "suggestions": [
            "yemek sıcaklığının düzenli kontrol edilmesi",
            "pişirme ve kalite kontrol sürecinin sıklaştırılması",
            "porsiyon miktarlarının tekrar değerlendirilmesi",
            "günlük tadım ve kalite kontrol formu uygulanması",
            "yemek içeriklerinin daha dengeli planlanması",
        ],
    },
    ("Yemekhane", "Hijyen/Temizlik"): {
        "subjects": [
            "yemekhane masaları",
            "tabak ve çatallar",
            "tepsi alanı",
            "salata bölümündeki alan",
            "yemekhane zemini",
            "servis bankosu",
        ],
        "problems": [
            "yeterince temiz görünmüyor",
            "üzerinde leke kalıyor",
            "yoğun saatlerde temizlenmeden tekrar kullanılıyor",
            "kötü koku oluşmasına neden oluyor",
            "hijyen açısından rahatsızlık yaratıyor",
            "düzenli dezenfekte edilmiyor gibi duruyor",
        ],
        "suggestions": [
            "temizlik kontrollerinin sıklaştırılması",
            "yoğun saatlerde ek temizlik personeli görevlendirilmesi",
            "masa ve tepsi alanları için kontrol listesi oluşturulması",
            "hijyen denetimlerinin günlük kayıt altına alınması",
            "servis alanı temizliğinin vardiya bazlı takip edilmesi",
        ],
    },
    ("Yemekhane", "Ekipman/Fiziksel Alan"): {
        "subjects": [
            "yemekhanedeki ocak",
            "havalandırma sistemi",
            "yemekhane oturma alanı",
            "yemek dağıtım bankosu",
            "su sebili",
            "masa düzeni",
        ],
        "problems": [
            "sık sık arıza çıkarıyor",
            "alanı kullanmayı zorlaştırıyor",
            "yoğunlukta yetersiz kalıyor",
            "çalışanların rahat hareket etmesini engelliyor",
            "bakımsız görünüyor",
            "fiziksel olarak yenilenmeye ihtiyaç duyuyor",
        ],
        "suggestions": [
            "ekipman bakımının periyodik yapılması",
            "oturma alanının yeniden düzenlenmesi",
            "havalandırma sisteminin yenilenmesi",
            "yemekhane ekipmanları için bakım takip listesi oluşturulması",
            "yoğun saatlere göre fiziksel alan planlaması yapılması",
        ],
    },
    ("Yemekhane", "Menü Çeşitliliği"): {
        "subjects": [
            "haftalık menü",
            "öğle yemeği menüsü",
            "vejetaryen seçenekler",
            "diyet menü alternatifi",
            "tatlı ve meyve seçenekleri",
            "ana yemek listesi",
        ],
        "problems": [
            "çok sık kendini tekrar ediyor",
            "farklı beslenme tercihlerine yeterince hitap etmiyor",
            "alternatif seçenek sunmadığı için çalışanları zorluyor",
            "uzun süredir aynı yemeklerden oluşuyor",
            "sağlıklı seçenekler açısından yetersiz kalıyor",
            "vardiya çalışanları için yeterince planlı görünmüyor",
        ],
        "suggestions": [
            "menü çeşitliliğinin artırılması",
            "vejetaryen ve hafif yemek seçeneklerinin eklenmesi",
            "haftalık menü planının çalışanlardan gelen önerilere göre güncellenmesi",
            "sağlıklı atıştırmalık ve meyve alternatiflerinin artırılması",
            "menülerin aylık olarak daha dengeli planlanması",
        ],
    },
    ("Yemekhane", "Sıra/Kalabalık"): {
        "subjects": [
            "yemekhane sırası",
            "öğle molasındaki yoğunluk",
            "yemek dağıtım noktası",
            "oturma alanındaki kalabalık",
            "tepsi alma bölümü",
            "servis bankosu önü",
        ],
        "problems": [
            "çok uzun sürüyor",
            "molamızın büyük kısmını bekleyerek geçirmemize neden oluyor",
            "yoğun saatlerde kontrolsüz şekilde artıyor",
            "çalışanların oturacak yer bulmasını zorlaştırıyor",
            "yemek alma sürecini gereksiz uzatıyor",
            "vardiya geçişlerinde büyük yığılma oluşturuyor",
        ],
        "suggestions": [
            "yemek saatlerinin departmanlara göre kademelendirilmesi",
            "ek dağıtım noktası açılması",
            "oturma düzeninin yoğun saatlere göre yeniden planlanması",
            "sıra yönetimi için yönlendirme yapılması",
            "vardiya geçişlerinde ek personel desteği sağlanması",
        ],
    },
    ("Yemekhane", "Personel Davranışı"): {
        "subjects": [
            "yemekhane personeli",
            "yemek dağıtımındaki görevli",
            "servis bankosundaki çalışan",
            "kasa bölümündeki personel",
            "salata bölümündeki görevli",
            "çay alanındaki görevli",
        ],
        "problems": [
            "çalışanlarla iletişimde kaba davranıyor",
            "sorulara ilgisiz cevap veriyor",
            "yoğunluk sırasında aceleci ve sert davranıyor",
            "geri bildirimleri dikkate almıyor gibi görünüyor",
            "iletişim konusunda daha dikkatli olmalı",
            "çalışanlara eşit ve özenli yaklaşmıyor",
        ],
        "suggestions": [
            "yemekhane personeline iletişim eğitimi verilmesi",
            "hizmet kalitesi için geri bildirim takibi yapılması",
            "yoğun saatlerde çalışan iletişimi konusunda standart belirlenmesi",
            "personel davranışlarının düzenli değerlendirilmesi",
            "çalışan memnuniyeti için hizmet yaklaşımının gözden geçirilmesi",
        ],
    },
    ("Servis", "Saat/Gecikme"): {
        "subjects": [
            "sabah servisi",
            "akşam servisi",
            "vardiya çıkış servisi",
            "ana duraktaki servis",
            "15-A hattındaki servis",
        ],
        "problems": [
            "sürekli geç geliyor",
            "belirtilen saatten önce hareket ediyor",
            "durakta uzun süre bekletiyor",
            "mesai başlangıcına yetişmemizi zorlaştırıyor",
            "çıkış saatinden sonra çok geç kalkıyor",
        ],
        "suggestions": [
            "servis saatlerinin tekrar düzenlenmesi",
            "servis hareket saatlerinin uygulamada gösterilmesi",
            "gecikmeler için bilgilendirme yapılması",
            "vardiya saatlerine göre ek servis planlanması",
            "servis takip sisteminin devreye alınması",
        ],
    },
    ("Servis", "Güzergah/Durak"): {
        "subjects": [
            "servis güzergahı",
            "sabah servis rotası",
            "akşam servis rotası",
            "fabrika çıkış durağı",
            "ana yol üzerindeki durak",
            "15-A hattının durak planı",
        ],
        "problems": [
            "bazı çalışanlar için gereğinden fazla dolanıyor",
            "durak sıralaması yüzünden yolculuğu çok uzatıyor",
            "belirtilen durakta düzenli durmuyor",
            "ana duraktan geçmeden farklı yoldan ilerliyor",
            "yeni yerleşim alanlarını kapsamadığı için çalışanları zorluyor",
            "durak bilgileri net olmadığı için karışıklık oluşturuyor",
        ],
        "suggestions": [
            "güzergahların çalışan yoğunluğuna göre yeniden planlanması",
            "durak listesinin uygulamada açık şekilde gösterilmesi",
            "yeni durak talepleri için düzenli değerlendirme yapılması",
            "servis rotalarının vardiya saatlerine göre optimize edilmesi",
            "durak değişikliklerinin önceden bildirilmesi",
        ],
    },
    ("Servis", "Araç Konforu"): {
        "subjects": [
            "servis aracının kliması",
            "araç içindeki koltuklar",
            "servis aracının iç temizliği",
            "araç içi havalandırma",
            "servis aracındaki emniyet kemerleri",
        ],
        "problems": [
            "düzgün çalışmıyor",
            "yolculuğu rahatsız hale getiriyor",
            "çok kirli görünüyor",
            "ağır kokuya sebep oluyor",
            "kontrol edilmesi gerekiyor",
        ],
        "suggestions": [
            "araç içi temizliğin düzenli yapılması",
            "klima bakımının periyodik hale getirilmesi",
            "koltukların yenilenmesi",
            "emniyet kemeri kontrollerinin artırılması",
            "servis araçlarında konfor kontrol listesi uygulanması",
        ],
    },
    ("Servis", "Şoför Davranışı"): {
        "subjects": [
            "servis şoförü",
            "sabah hattındaki şoför",
            "akşam servisindeki sürücü",
            "servisi kullanan sürücü",
            "güzergah şoförü",
        ],
        "problems": [
            "yolcularla kaba konuşuyor",
            "sorulara ilgisiz cevap veriyor",
            "durakta bekleyen çalışanlara aceleci davranıyor",
            "yolcularla iletişim kurarken saygısız bir tavır sergiliyor",
            "şikayetleri dikkate almıyor",
        ],
        "suggestions": [
            "şoförlere iletişim eğitimi verilmesi",
            "yolcu iletişimi için standart belirlenmesi",
            "şikayetlerin şoförlere düzenli aktarılması",
            "şoför davranışları için geri bildirim formu oluşturulması",
            "servis sürücülerine kurum içi davranış kurallarının hatırlatılması",
        ],
    },
    ("Servis", "Güvenlik/Risk"): {
        "subjects": [
            "servis aracı",
            "servis şoförü",
            "sabah servisi",
            "akşam servisi",
            "15-A hattındaki araç",
        ],
        "problems": [
            "çok hızlı kullanılıyor",
            "ani frenlerle yolcuları tehlikeye atıyor",
            "kırmızı ışıkta geçiyor",
            "hareket halindeyken kapı arızası yaşatıyor",
            "kaza riski oluşturacak şekilde kullanılıyor",
        ],
        "suggestions": [
            "sürüş güvenliği denetimlerinin artırılması",
            "araçların fren ve kapı kontrollerinin düzenli yapılması",
            "şoförlere güvenli sürüş eğitimi verilmesi",
            "riskli sürüşlerin raporlanacağı bir takip sistemi kurulması",
            "servis araçlarında güvenlik kontrol listesinin zorunlu olması",
        ],
    },
    ("Teknik Destek", "Donanım Sorunu"): {
        "subjects": [
            "bilgisayarım",
            "laptopum",
            "ekranım",
            "klavyem",
            "departmandaki yazıcı",
        ],
        "problems": [
            "sık sık arıza veriyor",
            "çalışırken kapanıyor",
            "fiziksel olarak düzgün çalışmıyor",
            "iş akışını aksatıyor",
            "teknik kontrol gerektiriyor",
        ],
        "suggestions": [
            "donanım bakım planının düzenli yapılması",
            "eski cihazların yenilenmesi",
            "yedek ekipman sürecinin hızlandırılması",
            "cihaz kontrollerinin periyodik yapılması",
            "çalışanlara ergonomik ekipman seçenekleri sunulması",
        ],
    },
    ("Teknik Destek", "Yazılım Sorunu"): {
        "subjects": [
            "kullandığımız uygulama",
            "ERP sistemi",
            "raporlama ekranı",
            "personel portalı",
            "veritabanı bağlantısı",
        ],
        "problems": [
            "sık sık hata veriyor",
            "işlem sırasında kapanıyor",
            "kayıtları doğru göstermiyor",
            "güncellemeden sonra çalışmıyor",
            "iş süreçlerini aksatıyor",
        ],
        "suggestions": [
            "yazılım hatalarının takip edildiği bir ekran açılması",
            "güncellemelerin önceden test edilmesi",
            "kritik uygulamalar için kullanıcı eğitimleri yapılması",
            "hata bildirimlerinin daha hızlı incelenmesi",
            "uygulama performansının düzenli izlenmesi",
        ],
    },
    ("Teknik Destek", "İnternet/Ağ Sorunu"): {
        "subjects": [
            "ofis interneti",
            "kablosuz ağ",
            "VPN bağlantısı",
            "toplantı odasındaki wifi",
            "şirket ağı",
        ],
        "problems": [
            "sürekli kopuyor",
            "çok yavaş çalışıyor",
            "bağlantı hatası veriyor",
            "online toplantıları aksatıyor",
            "dosya aktarımını zorlaştırıyor",
        ],
        "suggestions": [
            "wifi kapsama alanının genişletilmesi",
            "VPN altyapısının güçlendirilmesi",
            "toplantı odaları için ayrı ağ kurulması",
            "internet kesintileri için bilgilendirme yapılması",
            "konuk wifi ağının ayrı yönetilmesi",
        ],
    },
    ("Teknik Destek", "Erişim/Yetki Sorunu"): {
        "subjects": [
            "hesabım",
            "şifre sıfırlama ekranı",
            "ortak klasör erişimim",
            "proje dosyalarına erişimim",
            "sistem giriş yetkim",
        ],
        "problems": [
            "yetki hatası veriyor",
            "giriş yapmamı engelliyor",
            "dosyalara ulaşmamı engelliyor",
            "onay süreci çok uzun sürüyor",
            "işimi tamamlamamı geciktiriyor",
        ],
        "suggestions": [
            "yetki talepleri için self servis ekran açılması",
            "şifre sıfırlama sürecinin hızlandırılması",
            "erişim onaylarının uygulama üzerinden takip edilmesi",
            "ortak klasör yetkilerinin düzenli gözden geçirilmesi",
            "yeni başlayanlar için otomatik yetki şablonu oluşturulması",
        ],
    },
    ("Teknik Destek", "Sistem Performansı"): {
        "subjects": [
            "bilgisayar",
            "sistem",
            "sunucu",
            "raporlama ekranı",
            "iş uygulaması",
        ],
        "problems": [
            "çok yavaş çalışıyor",
            "sık sık donuyor",
            "işlem yaparken bekletiyor",
            "yoğun saatlerde cevap vermiyor",
            "performans düşüklüğü nedeniyle işi aksatıyor",
        ],
        "suggestions": [
            "sistem performansının düzenli izlenmesi",
            "eski bilgisayarların RAM kapasitesinin artırılması",
            "sunucu kaynaklarının güçlendirilmesi",
            "gereksiz arka plan servislerinin kapatılması",
            "yoğun saatler için performans iyileştirmesi yapılması",
        ],
    },
}


TEMPLATES.update(
    {
        ("Ortak Alan", "Tuvalet/Sarf Malzeme"): {
            "subjects": ["lavabolar", "tuvaletler", "sabunluklar", "peçete alanı", "kağıt havlu bölümü", "dezenfektan noktası"],
            "problems": ["sabun kalmadığı için kullanılamıyor", "peçete ve kağıt havlu eksik kalıyor", "temizlenmediği için kötü görünüyor", "yoğun saatlerde çok kirli kalıyor", "sarf malzeme kontrolü yapılmıyor gibi duruyor"],
            "suggestions": ["sarf malzeme kontrollerinin sıklaştırılması", "tuvaletler için saatlik kontrol listesi uygulanması", "sabun ve peçete takibinin düzenli yapılması", "eksik malzeme bildirimi için küçük bir QR formu konulması"],
        },
        ("Ortak Alan", "Dinlenme Alanı"): {
            "subjects": ["dinlenme alanı", "mola alanı", "çay kahve bölümü", "koltuklar", "ortak oturma alanı", "kantin çevresi", "bahçe", "çardak", "kamelya", "çay ocağı", "bahçedeki banklar", "oturma bankı"],
            "problems": ["çok dağınık kalıyor", "oturacak yer bulmayı zorlaştırıyor", "temiz ve düzenli tutulmuyor", "yoğun saatlerde yetersiz kalıyor", "mola sırasında rahat kullanılamıyor"],
            "suggestions": ["dinlenme alanının daha düzenli planlanması", "mola alanına ek oturma alanı yapılması", "çay kahve bölümünün daha sık kontrol edilmesi", "ortak alan kullanım kurallarının görünür hale getirilmesi", "bahçeye yeni oturma bankları yerleştirilmesi", "çay ocağına su sebili eklenmesi"],
        },
        ("Ortak Alan", "Toplantı Odası"): {
            "subjects": ["toplantı odası", "rezervasyon sistemi", "projeksiyon cihazı", "toplantı masası", "oda takvimi", "video konferans ekipmanı"],
            "problems": ["rezervasyon olmasına rağmen dolu oluyor", "ekipmanlar düzgün çalışmıyor", "oda kullanımı karışıklığa neden oluyor", "toplantı sırasında bağlantı problemi yaşatıyor", "düzenli bırakılmıyor"],
            "suggestions": ["toplantı odası rezervasyonlarının uygulamadan takip edilmesi", "oda ekipmanlarının günlük kontrol edilmesi", "kullanım sonrası oda düzeni için kontrol listesi oluşturulması", "toplantı odası müsaitlik bilgisinin görünür yapılması"],
        },
        ("Ortak Alan", "Asansör/Merdiven"): {
            "subjects": ["asansör", "merdivenler", "kat geçiş alanı", "asansör bekleme alanı", "yangın merdiveni", "merdiven aydınlatması"],
            "problems": ["sık sık arıza yapıyor", "çok uzun beklemeye neden oluyor", "kaygan olduğu için risk oluşturuyor", "aydınlatması yetersiz kalıyor", "geçişi zorlaştıracak şekilde kalabalık oluyor"],
            "suggestions": ["asansör bakımının düzenli yapılması", "merdiven kaydırmazlarının kontrol edilmesi", "asansör arıza bilgisinin uygulamada gösterilmesi", "kat geçiş alanlarının daha düzenli tutulması"],
        },
        ("Ortak Alan", "Otopark"): {
            "subjects": ["otopark", "araç giriş alanı", "park yerleri", "ziyaretçi park alanı", "motosiklet park yeri", "otopark çizgileri"],
            "problems": ["yer bulmayı zorlaştırıyor", "araç geçişini engelleyecek şekilde kullanılıyor", "park çizgileri belirsiz kalıyor", "yoğun saatlerde yetersiz kalıyor", "giriş çıkışta karışıklık oluşturuyor"],
            "suggestions": ["otopark çizgilerinin yenilenmesi", "ziyaretçi park alanının ayrılması", "otopark doluluk bilgisinin gösterilmesi", "araç giriş çıkış yönlendirmelerinin artırılması"],
        },
        ("Ortak Alan", "Fiziksel Düzen"): {
            "subjects": ["ortak alan düzeni", "koridorlar", "mutfak alanı", "geçiş yolları", "bekleme alanı", "dolap çevresi"],
            "problems": ["dağınık kaldığı için geçişi zorlaştırıyor", "eşyalar ortada bırakılıyor", "alan kullanımı verimsiz görünüyor", "temizlik ve düzen açısından sorun yaratıyor", "çalışanların rahat hareket etmesini engelliyor"],
            "suggestions": ["ortak alan düzeninin yeniden planlanması", "eşya bırakma alanlarının belirlenmesi", "koridor ve geçiş alanları için düzenli kontrol yapılması", "ortak alan kullanım kurallarının netleştirilmesi"],
        },
        ("İK / Personel İşleri", "İzin/Süreç Bilgilendirme"): {
            "subjects": ["izin süreci", "rapor onayı", "personel talebi", "onay akışı", "bordro dışı süreç", "izin ekranı"],
            "problems": ["çok geç sonuçlanıyor", "hangi aşamada olduğu anlaşılmıyor", "çalışanı bilgilendirmeden bekletiyor", "onay süreci karışık ilerliyor", "geri dönüş almak zor oluyor"],
            "suggestions": ["izin taleplerinin uygulamadan takip edilmesi", "onay süreci için bildirim gönderilmesi", "süreç açıklamalarının daha net yazılması", "İK talepleri için durum ekranı oluşturulması"],
        },
        ("İK / Personel İşleri", "Maaş/Yan Haklar"): {
            "subjects": ["maaş bordrosu", "yan haklar", "yemek kartı", "servis hakkı", "prim bilgisi", "ödeme açıklaması"],
            "problems": ["açıklaması yeterince net değil", "çalışanların sorularına geç cevap veriliyor", "bilgi eksikliği yaratıyor", "takip etmeyi zorlaştırıyor", "yanlış anlaşılmaya neden oluyor"],
            "suggestions": ["yan hak bilgilerinin uygulamada gösterilmesi", "bordro açıklamalarının daha anlaşılır yapılması", "sık sorulan sorular alanı eklenmesi", "maaş ve yan hak süreçleri için bilgilendirme paylaşılması"],
        },
        ("İK / Personel İşleri", "Eğitim/Gelişim"): {
            "subjects": ["eğitim duyuruları", "oryantasyon süreci", "gelişim eğitimleri", "seminerler", "online eğitimler", "kurs talepleri"],
            "problems": ["yeterince duyurulmuyor", "katılım bilgisi net paylaşılmıyor", "çalışan ihtiyacına uygun planlanmıyor", "takip edilmesi zor oluyor", "yeni başlayanlar için eksik kalıyor"],
            "suggestions": ["eğitim takviminin uygulamada gösterilmesi", "çalışanların eğitim talebi oluşturabilmesi", "oryantasyon içeriklerinin dijital paylaşılması", "departman bazlı gelişim planı yapılması"],
        },
        ("İK / Personel İşleri", "İletişim/Bilgilendirme"): {
            "subjects": ["İK duyuruları", "personel bilgilendirmeleri", "şirket içi duyuru", "geri dönüş süreci", "İK iletişimi", "duyuru kanalı"],
            "problems": ["geç paylaşılıyor", "herkese aynı anda ulaşmıyor", "sorulara geç dönüş yapılıyor", "bilgi karmaşası oluşturuyor", "takip etmeyi zorlaştırıyor"],
            "suggestions": ["duyuruların uygulamadan bildirim olarak gönderilmesi", "İK iletişim taleplerinin takip edilebilir olması", "önemli duyurular için sabit ekran oluşturulması", "geri dönüş sürelerinin görünür hale getirilmesi"],
        },
        ("Güvenlik", "İş Güvenliği Riski"): {
            "subjects": ["üretim alanı", "zemin", "koruyucu ekipman", "iş güvenliği alanı", "yükleme bölgesi", "geçiş yolu"],
            "problems": ["çalışan güvenliği açısından risk oluşturuyor", "yaralanmaya sebep olabilir", "koruyucu ekipman kullanılmadan işlem yapılıyor", "kayma ve düşme riski yaratıyor", "acil müdahale gerektirebilir"],
            "suggestions": ["iş güvenliği denetimlerinin artırılması", "riskli alanların işaretlenmesi", "koruyucu ekipman kontrollerinin sıklaştırılması", "tehlike bildirimi için hızlı kayıt ekranı açılması"],
        },
        ("Güvenlik", "Acil Durum/Ekipman"): {
            "subjects": ["yangın tüpü", "acil çıkış", "alarm sistemi", "ilk yardım dolabı", "acil durum ekipmanı", "toplanma alanı"],
            "problems": ["kontrol tarihi geçmiş görünüyor", "erişimi zor bir yerde duruyor", "çalışıp çalışmadığı bilinmiyor", "acil durumda kullanımı zorlaştırıyor", "eksik veya bakımsız görünüyor"],
            "suggestions": ["acil durum ekipmanlarının düzenli kontrol edilmesi", "yangın tüpü tarihlerinin takip edilmesi", "acil çıkış yönlendirmelerinin yenilenmesi", "toplanma alanı bilgisinin uygulamada gösterilmesi"],
        },
        ("Güvenlik", "Giriş-Çıkış/Güvenlik Kontrolü"): {
            "subjects": ["turnike", "giriş kartı", "güvenlik kontrolü", "ziyaretçi girişi", "personel geçişi", "kapı kontrol noktası"],
            "problems": ["geçiş sırasında sorun çıkarıyor", "yoğunluk oluşturuyor", "kartı okumadığı için bekletiyor", "ziyaretçi sürecini uzatıyor", "giriş çıkışta karışıklığa neden oluyor"],
            "suggestions": ["turnike kontrollerinin artırılması", "kart sorunları için hızlı destek akışı oluşturulması", "ziyaretçi giriş sürecinin dijitalleştirilmesi", "yoğun saatlerde ek güvenlik desteği verilmesi"],
        },
        ("Güvenlik", "Fiziksel Risk"): {
            "subjects": ["kırık cam", "açıkta kablo", "kaygan zemin", "bozuk kapı", "merdiven kenarı", "zemindeki çukur"],
            "problems": ["düşme riski oluşturuyor", "çalışanların zarar görmesine neden olabilir", "fiziksel tehlike yaratıyor", "acil onarım gerektiriyor", "güvenli geçişi engelliyor"],
            "suggestions": ["riskli alanların hızlıca işaretlenmesi", "fiziksel risklerin bakım ekibine otomatik yönlendirilmesi", "periyodik saha kontrolü yapılması", "risk bildirimi için öncelikli kategori açılması"],
        },
        ("Çalışma Ortamı", "Isıtma/Soğutma"): {
            "subjects": ["ofis kliması", "çalışma alanı sıcaklığı", "havalandırma", "toplantı odası kliması", "üretim ofisi", "ortam sıcaklığı"],
            "problems": ["çok sıcak olduğu için çalışmayı zorlaştırıyor", "çok soğuk olduğu için rahatsız ediyor", "hava akışı yetersiz kalıyor", "klima düzgün çalışmıyor", "gün içinde sürekli değişiyor"],
            "suggestions": ["ısı ayarlarının daha dengeli yapılması", "havalandırma kontrollerinin artırılması", "ofis sıcaklığı için düzenli ölçüm yapılması", "klima bakımının periyodik yapılması"],
        },
        ("Çalışma Ortamı", "Gürültü"): {
            "subjects": ["ofis içi ses", "çalışma alanındaki gürültü", "makine sesi", "telefon konuşmaları", "ortak çalışma alanı", "koridor sesi"],
            "problems": ["odaklanmayı zorlaştırıyor", "toplantıları bölüyor", "gün boyu rahatsızlık veriyor", "çalışma verimini düşürüyor", "sessiz çalışma ihtiyacını karşılamıyor"],
            "suggestions": ["sessiz çalışma alanı oluşturulması", "gürültülü ekipmanların izole edilmesi", "toplantı ve telefon görüşmeleri için ayrı alan belirlenmesi", "akustik düzenleme yapılması"],
        },
        ("Çalışma Ortamı", "Aydınlatma"): {
            "subjects": ["ofis aydınlatması", "masa üstü ışık", "koridor lambaları", "toplantı odası ışığı", "çalışma alanı", "pencere tarafı"],
            "problems": ["yetersiz kaldığı için göz yoruyor", "çok parlak olduğu için rahatsız ediyor", "bazı lambalar çalışmıyor", "ekran kullanımını zorlaştırıyor", "karanlık alan oluşturuyor"],
            "suggestions": ["aydınlatmanın çalışma alanına göre düzenlenmesi", "bozuk lambaların hızlı değiştirilmesi", "göz yormayan ışık kullanılması", "masa bazlı aydınlatma seçenekleri sunulması"],
        },
        ("Çalışma Ortamı", "Ergonomi"): {
            "subjects": ["çalışma masası", "ofis sandalyesi", "ekran yüksekliği", "klavye mouse düzeni", "oturma düzeni", "masa yerleşimi"],
            "problems": ["uzun süre çalışınca rahatsızlık yaratıyor", "bel ve boyun ağrısına neden oluyor", "çalışma pozisyonunu bozuyor", "ergonomik açıdan yetersiz kalıyor", "ekran kullanımı için uygun değil"],
            "suggestions": ["ergonomik sandalye seçeneklerinin artırılması", "ekran yükseltici desteği sağlanması", "masa düzeninin çalışan sağlığına göre planlanması", "ergonomi değerlendirmesi yapılması"],
        },
        ("Çalışma Ortamı", "Alan Yetersizliği"): {
            "subjects": ["ofis alanı", "çalışma masaları", "dolap alanı", "ekip çalışma bölgesi", "ortak masa düzeni", "geçiş alanı"],
            "problems": ["çok sıkışık olduğu için çalışmayı zorlaştırıyor", "eşyalar için yeterli yer kalmıyor", "ekiplerin rahat hareket etmesini engelliyor", "kalabalık hissi yaratıyor", "alan paylaşımında karışıklık oluşturuyor"],
            "suggestions": ["masa yerleşiminin yeniden planlanması", "ek dolap veya depolama alanı oluşturulması", "ekip alanlarının ihtiyaca göre düzenlenmesi", "ortak kullanım alanlarının sadeleştirilmesi"],
        },
        ("Öneri ve İyileştirme", "Süreç İyileştirme"): {
            "subjects": ["onay süreci", "talep akışı", "günlük iş süreci", "form doldurma adımı", "manuel takip", "operasyon akışı"],
            "problems": ["gereğinden fazla zaman alıyor", "tekrar eden işler oluşturuyor", "takip etmeyi zorlaştırıyor", "gereksiz efor yaratıyor", "ekipler arasında bilgi kopukluğu oluşturuyor"],
            "suggestions": ["sürecin dijitalleştirilmesi", "onay adımlarının sadeleştirilmesi", "otomatik bildirim eklenmesi", "tekrar eden işlerin azaltılması", "talep durumunun uygulamada takip edilmesi"],
        },
        ("Öneri ve İyileştirme", "Sosyal Etkinlik"): {
            "subjects": ["sosyal etkinlikler", "çalışan motivasyonu", "turnuva fikri", "ekip buluşmaları", "kulüp etkinlikleri", "şirket içi organizasyon"],
            "problems": ["yeterince duyurulmuyor", "çalışan katılımı için seçenek az kalıyor", "departmanlar arası iletişimi desteklemiyor", "motivasyon tarafında eksik kalıyor", "planlama düzenli yapılmıyor"],
            "suggestions": ["düzenli sosyal etkinlik takvimi oluşturulması", "çalışanların etkinlik önerisi girebilmesi", "departmanlar arası turnuva planlanması", "gönüllü kulüp sistemi kurulması"],
        },
        ("Öneri ve İyileştirme", "Teknolojik İyileştirme"): {
            "subjects": ["mobil uygulama", "dijital ekran", "otomasyon fikri", "bildirim sistemi", "raporlama aracı", "takip paneli"],
            "problems": ["manuel takip gerektirdiği için zaman kaybettiriyor", "bilgiye ulaşmayı zorlaştırıyor", "teknolojik destek eksikliği yaratıyor", "raporlamayı yavaşlatıyor", "kullanıcı deneyimini düşürüyor"],
            "suggestions": ["mobil uygulamaya yeni takip ekranı eklenmesi", "bildirim sisteminin geliştirilmesi", "otomatik raporlama aracı yapılması", "talep ve şikayetlerin dijital panelden izlenmesi"],
        },
        ("Öneri ve İyileştirme", "Çalışan Deneyimi"): {
            "subjects": ["çalışan deneyimi", "geri bildirim süreci", "motivasyon uygulamaları", "iç iletişim", "memnuniyet takibi", "öneri sistemi"],
            "problems": ["çalışan sesini yeterince görünür kılmıyor", "geri bildirimlerin takibi zor oluyor", "motivasyonu artıracak uygulamalar eksik kalıyor", "memnuniyet düzenli ölçülmüyor", "önerilerin sonucu takip edilemiyor"],
            "suggestions": ["geri bildirimlerin durumunun çalışanlara gösterilmesi", "çalışan önerileri için puanlama sistemi kurulması", "memnuniyet anketlerinin uygulamada yapılması", "öneri sonucunun çalışanla paylaşılması"],
        },
        ("Diğer", "Çoklu Konu"): {
            "subjects": ["geri bildirim", "mesaj", "şikayet", "genel konu", "çalışan bildirimi", "birden fazla sorun"],
            "problems": ["birden fazla konuyu aynı anda içeriyor", "tek kategoriye sığmıyor", "hem teknik hem idari konu barındırıyor", "farklı ekiplerin incelemesini gerektiriyor", "ayrıştırılması gerekiyor"],
            "suggestions": ["çoklu konular için ayrı başlıklara bölme özelliği eklenmesi", "geri bildirim formunda birden fazla konu seçilebilmesi", "admin panelde çoklu konu etiketi gösterilmesi", "mesajların alt konuya ayrılabilmesi"],
        },
        ("Diğer", "Genel Bildirim"): {
            "subjects": ["genel geri bildirim", "çalışan yorumu", "kısa not", "belirsiz bildirim", "genel mesaj", "kategori dışı konu"],
            "problems": ["belirli bir kategoriye tam uymuyor", "genel bir memnuniyetsizlik içeriyor", "detaylandırılması gerekiyor", "hangi birime ait olduğu net anlaşılmıyor", "ek açıklama olmadan sınıflandırması zor kalıyor"],
            "suggestions": ["genel bildirimler için ek açıklama alanı eklenmesi", "kullanıcıdan kategori netleştirmesi istenmesi", "adminin manuel kategori seçebilmesi", "belirsiz bildirimler için ön inceleme yapılması"],
        },
    }
)


def load_dataset() -> list[dict]:
    with DATASET_PATH.open("r", encoding="utf-8") as dataset_file:
        return json.load(dataset_file)


def save_dataset(data: list[dict]) -> None:
    DATASET_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def build_text(
    category: str,
    detail: str,
    tone: str,
    subject: str,
    phrase: str,
) -> str:
    opener = random.choice(OPENERS)
    closer = random.choice(CLOSERS[tone])
    message_style = random.choice(["standard", "short", "long", "casual"])

    if message_style == "short":
        if tone == "DILEK_ONERI":
            return f"{phrase.capitalize()} iyi olabilir."
        return f"{subject.capitalize()} {phrase}."

    if message_style == "long":
        if tone == "DILEK_ONERI":
            return (
                f"{opener}{phrase} konusunda bir düzenleme yapılmasını öneriyorum. "
                f"Benzer geri bildirimlerin tekrar etmemesi için sürecin takip edilmesi faydalı olur. "
                f"{closer}"
            )
        return (
            f"{opener}{subject} {phrase}. "
            f"Bu durum sadece bir kişiyi değil, aynı alanı kullanan çalışanları da etkiliyor. "
            f"{closer}"
        )

    if message_style == "casual":
        if tone == "DILEK_ONERI":
            return f"{phrase.capitalize()} bence güzel bir iyileştirme olur. {closer}"
        return f"{subject.capitalize()} {phrase}, bu konu bir süredir dikkat çekiyor. {closer}"

    if tone == "ACIL_TEHLIKE":
        return f"{opener}{subject} {phrase}. {closer}"
    if tone == "DILEK_ONERI":
        return f"{opener}{phrase} konusunda bir düzenleme yapılması faydalı olur. {closer}"
    return f"{opener}{subject} {phrase}, bu durum günlük iş akışımızı olumsuz etkiliyor. {closer}"


def add_realistic_noise(text: str) -> str:
    """Gerçek çalışan mesajlarına benzeyen kontrollü gürültü ekler.

    Buradaki amaç küfür/argo üretmek değil; yazım hatası, günlük konuşma dili
    ve duygu belirten kısa eklerle modelin birebir kalıp ezberlemesini azaltmak.
    """
    updated_text = text

    if random.random() < 0.35:
        for source, alternatives in INFORMAL_REPLACEMENTS.items():
            if source in updated_text:
                updated_text = updated_text.replace(
                    source,
                    random.choice(alternatives),
                    1,
                )
                break

    if random.random() < 0.25:
        for source, replacement in TYPO_REPLACEMENTS.items():
            if source in updated_text:
                updated_text = updated_text.replace(source, replacement, 1)
                break

    if random.random() < 0.35:
        suffix = random.choice(NOISE_SUFFIXES)
        updated_text = f"{updated_text} {suffix}."

    if random.random() < 0.15:
        updated_text = updated_text.replace(".", "...")

    return updated_text


def generate_for_detail(
    category: str,
    detail: str,
    needed_count: int,
    existing_texts: set[str],
) -> list[dict]:
    config = TEMPLATES[(category, detail)]
    edge_cases = EDGE_CASES.get((category, detail), [])
    records = []
    tone_plan = []

    while len(tone_plan) < needed_count:
        for tone, priority, _default_count in TONE_CONFIG:
            tone_plan.append((tone, priority))
            if len(tone_plan) == needed_count:
                break

    random.shuffle(tone_plan)

    attempts = 0
    while len(records) < needed_count and attempts < needed_count * 50:
        attempts += 1
        use_edge_case = bool(edge_cases) and random.random() < 0.65

        if use_edge_case:
            tone, priority, text = random.choice(edge_cases)
        else:
            tone, priority = tone_plan[len(records)]
            subject = random.choice(config["subjects"])

            if tone == "DILEK_ONERI":
                phrase = random.choice(config["suggestions"])
                text = build_text(category, detail, tone, subject, phrase)
            else:
                phrase = random.choice(config["problems"])
                text = build_text(category, detail, tone, subject, phrase)

        text = add_realistic_noise(text)
        normalized = normalize_text(text)
        if normalized in existing_texts:
            continue

        existing_texts.add(normalized)
        records.append(
            {
                "category": category,
                "nlp_detail": detail,
                "tone": tone,
                "priority": priority,
                "text": text,
            }
        )

    if len(records) < needed_count:
        raise RuntimeError(
            f"{category} / {detail} için yeterli benzersiz kayıt üretilemedi. "
            f"İstenen: {needed_count}, üretilen: {len(records)}"
        )

    return records


def main() -> None:
    random.seed(RANDOM_SEED)
    dataset = load_dataset()
    counts = Counter((row["category"], row["nlp_detail"]) for row in dataset)
    existing_texts = {normalize_text(row["text"]) for row in dataset}
    new_records = []

    for key in sorted(TEMPLATES):
        current_count = counts.get(key, 0)
        _category, detail = key
        target_count = TARGET_COUNT_BY_DETAIL.get(
            detail,
            DEFAULT_TARGET_COUNT_PER_DETAIL,
        )
        needed_count = target_count - current_count

        if needed_count <= 0:
            continue

        category, detail = key
        print(f"{category} / {detail}: mevcut={current_count}, eklenecek={needed_count}")
        generated_records = generate_for_detail(
            category=category,
            detail=detail,
            needed_count=needed_count,
            existing_texts=existing_texts,
        )
        new_records.extend(generated_records)

    updated_dataset = dataset + new_records
    save_dataset(updated_dataset)

    print("\nEklendi:", len(new_records))
    print("Yeni toplam:", len(updated_dataset))
    print("\nGüncel dağılım:")
    updated_counts = Counter(
        (row["category"], row["nlp_detail"]) for row in updated_dataset
    )
    for (category, detail), count in sorted(updated_counts.items()):
        print(f"{category:15} | {detail:25} | {count}")


if __name__ == "__main__":
    main()
