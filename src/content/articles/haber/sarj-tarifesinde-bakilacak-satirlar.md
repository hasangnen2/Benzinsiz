---
title: "Şarj tarifesinde bakılacak satırlar"
description: "Birim fiyat, zaman dilimi ve kaynak satırı olmadan tarifeye rakam yazılmaz. Güncel değer veriye girilince haberde görünür."
heroImage: ../../../assets/covers/kapak-sarj-tarife.jpg
heroAlt: "Ekranı açık ticari şarj ünitesi ve prize takılı kablo"
heroCredit: "Spotter2 · CC BY-SA 4.0"
heroCreditUrl: "https://commons.wikimedia.org/wiki/File:Elektrisch_laadstation_voor_wagens_-_Aalter_-_2021-02.jpg"
type: haber
category: sarj
author: benzinsiz-editoru
publishedAt: "2026-11-21T21:00:00+03:00"
updatedAt: "2026-11-22T01:10:00+03:00"
summary:
  - "Ev faturası ile istasyon tabelası aynı fiyat değildir."
  - "Halka açık şarj bedeli, aktarılan enerjinin TL/kWh fiyatıdır."
  - "Birim fiyat, istasyonun kendi ilanından okunur; bu haber fiyat uydurmaz."
sources:
  - name: "Şarj Hizmeti Yönetmeliği, madde 25"
    url: "https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.39454.pdf"
  - name: "EPDK, Serbest Erişim Platformu Şarj@TR"
    url: "https://www.epdk.gov.tr/Detay/Icerik/1-3428/serbest-erisim-platformu--sarj@tr"
---

Bu haber, tarife duyurusunu işleme şablonudur. Kurum birim fiyatı açıklamadan metinde rakam yoktur. Açıklanınca değer, kaynak adresiyle veri dosyasına girer ve bu sayfanın güncelleme tarihi değişir.

## Faturada aranacak satırlar

Ev tarifesinde tek zaman ile zaman dilimli tarife ayrı satırlardır. Hangisinin sana uygulandığını fatura veya sözleşme söyler, tahmin değil.

Aranacak alanlar: enerji bedeli, dağıtım bedeli ve varsa zaman diliminin saati. Sayılar bugün [ev tarifesi TL/kWh] ve [gece dilimi TL/kWh] olarak boştur.

Dağıtım ile enerjiyi tek “kWh fiyatı” diye toplamak, ancak faturan o toplamı ayrıca gösteriyorsa doğrudur. Göstermiyorsa haber iki satırı ayrı bırakır.

## İstasyon tabelasında aranacak satırlar

AC ve DC aynı fiyat olmak zorunda değildir. Tabelada birim, oturum ücreti ve dakika ücreti ayrı ayrı aranır.

Oturum veya dakika bedeli yok denmez; tabelada yoksa “bu istasyon kaydında yok” diye yazılır. Güncel boş alanlar [AC TL/kWh] ve [DC TL/kWh] şeklindedir.

İstasyon işletmecisinin sayfası kaynak satırına bağlanmadan ekran görüntüsü tek başına yetmez. Sayfa adresi ve bakıldığı tarih birlikte durur.

## Yönetmelikte fiyatın cinsi

Şarj Hizmeti Yönetmeliği’nin 25. maddesi, 23 Mart 2026 tarihli değişiklikle, şarj hizmeti fiyatının elektrikli araca aktarılan enerjinin birim fiyatı cinsinden uygulanacağını yazar. Fatura veya yerine geçen belgede aktarılan enerji miktarına ayrıca yer verilir.

Aynı madde, bu bedelin dışında bağlanma, işlem başlatma veya şarj ekipmanı kullanımı adıyla ayrı bir bedel istenemeyeceğini söyler. Rezervasyon ve işgaliye, maddenin kendi istisnalarıdır: rezervasyon ücreti, o rezervasyonla şarj alındıktan sonra iade edilir. Şarjın bittiği kullanıcıya bildirildikten sonra araç ayrılmazsa ilave bedel alınabilir.

Ertesi günün fiyatı, içinde bulunulan günde saat 17.00’ye kadar Kuruma bildirilir ve ertesi gün saat 00.00’da yürür. Halka açık istasyonda, sadakat sözleşmesindeki en düşük fiyatın yüzde 25 fazlası aşılamaz. Sadakat için ayrı üyelik bedeli istenemez.

Lokasyon ve günün saatine göre indirim ayrıca ilan edilebilir. Saat dilimine göre indirimde, bedel şarjın başladığı dilimin fiyatıyla hesaplanır. DC ünitede, kullanıcıya önceden bilgi verilmişse batarya doluluğu yüzde 85 ve üzerindeyken şarj sonlandırılabilir.

Güncel soket fiyatı Şarj@TR ve işletmecinin kendi ilanındadır. Bu sayfa o tutarı kopyalamaz.

## Habere rakam ne zaman girer

Rakam, üç şey bir arada olunca girer: değer, kaynak adresi, güncelleme tarihi. Biri eksikse cümle kurulmaz, köşeli parantez kalır.

Bu kural sponsorlu metinde de değişmez. Reklamveren fiyatı, tarife kaynağının yerine geçmez.

## İlgili araç

Kendi faturandaki birim fiyatı [hesaplayıcıya](/arac/hesaplayici) yazabilirsin. Dosyadaki tarife boş olduğu sürece sonuç, senin girdiğin fiyata göre etiketlenir.

Kurulum sırası için [evde şarj istasyonu](/rehber/evde-sarj-istasyonu-kurulumu) rehberine bak. Orada da güç ve ücret, kaynak girilmeden yazılmaz.
