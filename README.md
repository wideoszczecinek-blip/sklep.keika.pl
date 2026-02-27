# KEIKA Sklep (LH-only) - szkielet od podstaw

Nowy sklep działa jako osobna aplikacja na subdomenie `sklep-keika.groovemedia.pl`, bez ruszania WordPressa na obecnym sklepie.

## Założenie techniczne (aktualne)
1. Hosting: obecny `LH` (bez dokupowania cloud/VPS).
2. Runtime: `PHP 8.4` + `HTML/CSS/JS`.
3. Routing: `.htaccess` + `index.php` (front controller).
4. Efekt: odświeżenie na `/admin`, `/katalog`, `/konfigurator/...` nie zrzuca użytkownika na stronę główną.

## Struktura
1. `.htaccess` - przepisywanie adresów do `index.php`
2. `index.php` - start aplikacji
3. `app/bootstrap.php` - routing + dane szkicu
4. `views/` - layout i ekrany
5. `assets/` - CSS/JS

## Dostępne ścieżki (szkielet)
1. `/`
2. `/katalog`
3. `/produkt/roleta-dachowa-classic`
4. `/konfigurator/roleta-dachowa-classic`
5. `/koszyk`
6. `/checkout`
7. `/admin`
8. `/admin/produkty`
9. `/admin/konfigurator`
10. `/admin/zamowienia`
11. `/admin/ustawienia`

## Deploy na LH (ta wersja)
1. Wgrywasz cały katalog tej aplikacji do subdomeny:
   `public_html/sklep-keika.groovemedia.pl`
2. Upewnij się, że `.htaccess` jest wgrany (bez niego refresh-safe routing nie zadziała).
3. PHP 8.4 może zostać.

## Następny krok (po szkielecie)
1. Dodać API `shop/v1` po stronie CRM (PHP)
2. Podpiąć panel sklepu i katalog do danych z CRM
3. Zbudować pierwszy realny konfigurator rolety dachowej
