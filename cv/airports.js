// cv/airports.js
// Uçuş formunda ülke -> havalimanı kaydırmalı seçim için veri. Acente paneli (TR) odaklı;
// ülke adları uygulamadaki uyruk adlarıyla aynı (eşleşsin diye). Liste başlıca havalimanları.
export const AIRPORTS = {
  'Türkiye': [
    'İstanbul Havalimanı (IST)', 'İstanbul Sabiha Gökçen (SAW)', 'Antalya (AYT)',
    'Ankara Esenboğa (ESB)', 'İzmir Adnan Menderes (ADB)', 'Adana (ADA)',
    'Bodrum Milas (BJV)', 'Dalaman (DLM)', 'Trabzon (TZX)', 'Gaziantep (GZT)', 'Kayseri (ASR)',
  ],
  'Kazakistan': ['Almatı (ALA)', 'Astana (NQZ)', 'Şımkent (CIT)', 'Aktau (SCO)', 'Atırau (GUW)', 'Karaganda (KGF)'],
  'Rusya': ['Moskova Şeremetyevo (SVO)', 'Moskova Domodedovo (DME)', 'Moskova Vnukovo (VKO)', 'St. Petersburg Pulkovo (LED)', 'Kazan (KZN)', 'Yekaterinburg (SVX)', 'Novosibirsk (OVB)', 'Soçi (AER)'],
  'Kırgızistan': ['Bişkek Manas (FRU)', 'Oş (OSS)'],
  'Özbekistan': ['Taşkent (TAS)', 'Semerkant (SKD)', 'Buhara (BHK)', 'Fergana (FEG)'],
  'Azerbaycan': ['Bakü Haydar Aliyev (GYD)', 'Gence (KVD)'],
  'Gürcistan': ['Tiflis (TBS)', 'Batum (BUS)', 'Kutaisi (KUT)'],
  'Ukrayna': ['Kiev Boryspil (KBP)', 'Kiev Juliany (IEV)', 'Lviv (LWO)', 'Odessa (ODS)'],
  'Belarus': ['Minsk (MSQ)'],
  'Türkmenistan': ['Aşkabat (ASB)', 'Türkmenbaşı (KRW)'],
  'Tayland': ['Bangkok Suvarnabhumi (BKK)', 'Bangkok Don Mueang (DMK)', 'Phuket (HKT)', 'Chiang Mai (CNX)'],
};

export const AIRPORT_COUNTRIES = Object.keys(AIRPORTS);
export const airportsOf = (country) => AIRPORTS[country] || [];
