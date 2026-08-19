# YKS Günlük Soru Defteri

YKS çalışan bir öğrencinin günlük çözdüğü soruları (doğru / yanlış / boş) kaydetmesi ve geçmiş günleri grafikte görmesi için yerel bir web arayüzü.

Kayıtlar bu bilgisayardaki ortak `yks.db` (SQLite) dosyasına yazılır. Chrome, Safari veya Firefox fark etmez: hepsi aynı adresi açınca aynı veriyi görür.

## Çalıştırma

Python 3 yeterlidir; ek paket kurulmaz.

```bash
python3 server.py
```

Tarayıcıda aç:

[http://127.0.0.1:5173](http://127.0.0.1:5173)

`index.html` dosyasına çift tıklama (`file://`) ortak veritabanına bağlanmaz. Sunucu açık kalmalıdır.

## Kullanım

1. TYT / AYT / YDT seç.
2. Derslere doğru, yanlış ve boş sayılarını yaz.
3. **Yerel veritabanına kaydet** — kayıt `yks.db` içine eklenir, tablo yeni giriş için sıfırlanır.
4. Aynı gün tekrar kaydedersen sayılar üzerine eklenir.
5. Sağdaki grafiklerde günlük soru/net ve derslere göre TYT–AYT yığın sütunları görünür.

Net hesabı: `doğru − yanlış / 4`.

## Veri

- Veritabanı dosyası: `yks.db` (proje klasöründe, git’e girmez)
- Yedeklemek için bu dosyayı kopyalaman yeter
- Başka bilgisayarda geçmişi taşımak istiyorsan `yks.db` dosyasını da yanına al

## Proje dosyaları

| Dosya | Görevi |
| --- | --- |
| `server.py` | Yerel sunucu + SQLite API |
| `index.html` | Arayüz |
| `app.js` | Kayıt, grafikler, form |
| `styles.css` | Görünüm |
