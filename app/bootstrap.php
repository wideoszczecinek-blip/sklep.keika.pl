<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

$site = [
    'name' => 'KEIKA Sklep',
    'tagline' => 'Nowoczesny sklep rolet i osłon z konfiguracją krok po kroku',
    'locale' => 'pl-PL',
];

$catalogProducts = [
    [
        'id' => 1,
        'slug' => 'roleta-dachowa-classic',
        'name' => 'Roleta dachowa Classic',
        'category' => 'Rolety dachowe',
        'lead_time_label' => '7-10 dni roboczych',
        'price_from' => 429.00,
        'badge' => 'MVP #1',
        'short' => 'Startowy produkt MVP z konfiguracją wymiarów, montażu i materiału.',
        'highlight' => 'Najlepszy punkt startowy do dopracowania UX konfiguratora.',
    ],
    [
        'id' => 2,
        'slug' => 'plisa-dachowa-comfort',
        'name' => 'Plisa dachowa Comfort',
        'category' => 'Plisy dachowe',
        'lead_time_label' => '9-12 dni roboczych',
        'price_from' => 519.00,
        'badge' => 'Następny etap',
        'short' => 'Drugi produkt do wdrożenia po domknięciu rolety dachowej.',
        'highlight' => 'Ten produkt pokazuje skalowalność silnika konfiguratora.',
    ],
];

$adminSections = [
    'dashboard' => [
        'label' => 'Dashboard',
        'title' => 'Panel sklepu - dashboard',
        'intro' => 'Widok startowy panelu sklepu. Tu będą szybkie skróty do katalogu, konfiguratora i zamówień.',
        'cards' => [
            ['title' => 'Katalog', 'text' => 'Produkty, warianty, zdjęcia, dostępność i czasy realizacji.'],
            ['title' => 'Konfigurator', 'text' => 'Definicja kroków, logika pól, reguły kompatybilności i walidacja.'],
            ['title' => 'Wycena', 'text' => 'Macierze cenowe szerokość x wysokość + dopłaty kwotowe/procentowe.'],
            ['title' => 'Integracje', 'text' => 'Checkout, płatności, dostawa i później synchronizacje operacyjne.'],
        ],
    ],
    'produkty' => [
        'label' => 'Produkty',
        'title' => 'Panel sklepu - produkty',
        'intro' => 'Szkielet listy produktów i wariantów. To będzie pierwszy realny moduł panelu po API shop/v1.',
        'cards' => [
            ['title' => 'Lista produktów', 'text' => 'Tabela z filtrowaniem, statusami, miniaturą i akcjami edycji.'],
            ['title' => 'Warianty', 'text' => 'Powiązanie z kolorami / materiałami / typami montażu.'],
            ['title' => 'Media', 'text' => 'Upload zdjęć i przypisanie zdjęć do produktu lub wariantu.'],
            ['title' => 'Publikacja', 'text' => 'Status roboczy/opublikowany + kolejność w katalogu.'],
        ],
    ],
    'konfigurator' => [
        'label' => 'Konfigurator',
        'title' => 'Panel sklepu - konfigurator',
        'intro' => 'Tu będzie serce projektu: definicja kroków, pól i reguł dla rolety dachowej.',
        'cards' => [
            ['title' => 'Kroki', 'text' => 'Kolejność kroków i warunki przejścia w flow konfiguratora.'],
            ['title' => 'Pola', 'text' => 'Typy pól (select, radio, wymiar, checkbox, liczba) i walidacja.'],
            ['title' => 'Reguły', 'text' => 'Kompatybilność opcji, blokady i komunikaty dla użytkownika.'],
            ['title' => 'Preselecty', 'text' => 'Podstawy pod przejście z AI/quizu do gotowej konfiguracji.'],
        ],
    ],
    'zamowienia' => [
        'label' => 'Zamówienia',
        'title' => 'Panel sklepu - zamówienia',
        'intro' => 'W tym szkielecie pokazujemy miejsce na listę zamówień i mapowanie statusów do CRM.',
        'cards' => [
            ['title' => 'Lista', 'text' => 'Nowe, opłacone, w produkcji, wysłane - z filtrowaniem po statusie.'],
            ['title' => 'Szczegóły', 'text' => 'Podgląd konfiguracji produktu i rozbicia ceny.'],
            ['title' => 'CRM sync', 'text' => 'Mapowanie statusów sklepu do obecnego procesu w CRM.'],
            ['title' => 'Płatności / dostawa', 'text' => 'Statusy P24 i informacje o wysyłce dla obsługi.'],
        ],
    ],
    'ustawienia' => [
        'label' => 'Ustawienia',
        'title' => 'Panel sklepu - ustawienia',
        'intro' => 'Miejsce na parametry sklepu (metody dostawy, języki, checkout, komunikaty).',
        'cards' => [
            ['title' => 'Języki', 'text' => 'Architektura ready pod PL/DE/EN (bez twardych tekstów w kodzie).'],
            ['title' => 'Checkout', 'text' => 'Dostawy, płatności, pola formularza i polityki.'],
            ['title' => 'Komunikaty', 'text' => 'Szablony treści systemowych i maili w przyszłych etapach.'],
            ['title' => 'Integracje', 'text' => 'Punkt pod konfigurację P24 i kolejne integracje.'],
        ],
    ],
];

$demoFaq = [
    ['q' => 'Którą ścieżkę wybrać?', 'a' => 'Klasyczny katalog dla klientów zdecydowanych. Przewodnik/AI dla niezdecydowanych.'],
    ['q' => 'Czy konfigurator będzie działał na telefonie?', 'a' => 'Tak, to priorytet. Projekt i testy są mobile-first.'],
    ['q' => 'Czy odświeżenie strony zresetuje widok?', 'a' => 'Nie. Każdy główny widok ma osobny adres i działa z routingiem po stronie serwera.'],
];

$path = '/';
$requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$parsedPath = parse_url($requestUri, PHP_URL_PATH);
if (is_string($parsedPath) && $parsedPath !== '') {
    $path = $parsedPath;
}
$path = '/' . trim($path, '/');
if ($path === '//') {
    $path = '/';
}

$route = [
    'name' => 'not-found',
    'path' => $path,
    'status' => 404,
    'template' => '404',
    'title' => '404 - Nie znaleziono',
    'description' => 'Nie znaleziono żądanego widoku sklepu.',
    'is_admin' => false,
    'body_class' => 'page-shell page-not-found',
    'data' => [],
];

$productIndex = [];
foreach ($catalogProducts as $product) {
    $productIndex[$product['slug']] = $product;
}

if ($path === '/') {
    $route = [
        'name' => 'home',
        'path' => $path,
        'status' => 200,
        'template' => 'home',
        'title' => 'Nowoczesny sklep rolet - szkic MVP',
        'description' => 'Szkielet nowego sklepu KEIKA na LH (PHP + JS + CSS) z routingiem bez zrzucania do strony głównej.',
        'is_admin' => false,
        'body_class' => 'page-shell page-home',
        'data' => [
            'featured_product' => $catalogProducts[0],
            'products' => $catalogProducts,
            'faq' => $demoFaq,
        ],
    ];
} elseif ($path === '/katalog') {
    $route = [
        'name' => 'catalog',
        'path' => $path,
        'status' => 200,
        'template' => 'catalog',
        'title' => 'Katalog produktów - szkic',
        'description' => 'Widok listy produktów pod MVP sklepu.',
        'is_admin' => false,
        'body_class' => 'page-shell page-catalog',
        'data' => ['products' => $catalogProducts],
    ];
} elseif ($path === '/koszyk') {
    $route = [
        'name' => 'cart',
        'path' => $path,
        'status' => 200,
        'template' => 'cart',
        'title' => 'Koszyk - szkic',
        'description' => 'Szkielet koszyka dla nowego sklepu.',
        'is_admin' => false,
        'body_class' => 'page-shell page-cart',
        'data' => ['items' => [$catalogProducts[0]]],
    ];
} elseif ($path === '/checkout') {
    $route = [
        'name' => 'checkout',
        'path' => $path,
        'status' => 200,
        'template' => 'checkout',
        'title' => 'Checkout - szkic',
        'description' => 'Szkielet checkoutu (MVP) pod LH.',
        'is_admin' => false,
        'body_class' => 'page-shell page-checkout',
        'data' => ['items' => [$catalogProducts[0]]],
    ];
} elseif (preg_match('#^/produkt/([a-z0-9-]+)$#', $path, $m)) {
    $slug = $m[1];
    if (isset($productIndex[$slug])) {
        $route = [
            'name' => 'product',
            'path' => $path,
            'status' => 200,
            'template' => 'product',
            'title' => $productIndex[$slug]['name'] . ' - karta produktu',
            'description' => 'Szkielet karty produktu z wejściem do konfiguratora.',
            'is_admin' => false,
            'body_class' => 'page-shell page-product',
            'data' => ['product' => $productIndex[$slug]],
        ];
    }
} elseif (preg_match('#^/konfigurator/([a-z0-9-]+)$#', $path, $m)) {
    $slug = $m[1];
    if (isset($productIndex[$slug])) {
        $route = [
            'name' => 'configurator',
            'path' => $path,
            'status' => 200,
            'template' => 'configurator',
            'title' => 'Konfigurator - ' . $productIndex[$slug]['name'],
            'description' => 'Szkielet konfiguratora krokowego rolety.',
            'is_admin' => false,
            'body_class' => 'page-shell page-configurator',
            'data' => ['product' => $productIndex[$slug]],
        ];
    }
} elseif ($path === '/admin' || $path === '/admin/') {
    $sectionKey = 'dashboard';
    $section = $adminSections[$sectionKey];
    $route = [
        'name' => 'admin',
        'path' => '/admin',
        'status' => 200,
        'template' => 'admin',
        'title' => $section['title'],
        'description' => 'Szkielet panelu sklepu KEIKA.',
        'is_admin' => true,
        'body_class' => 'page-shell page-admin',
        'data' => [
            'section_key' => $sectionKey,
            'section' => $section,
            'sections' => $adminSections,
        ],
    ];
} elseif (preg_match('#^/admin/([a-z0-9-]+)$#', $path, $m)) {
    $sectionKey = $m[1];
    if (isset($adminSections[$sectionKey])) {
        $section = $adminSections[$sectionKey];
        $route = [
            'name' => 'admin-' . $sectionKey,
            'path' => $path,
            'status' => 200,
            'template' => 'admin',
            'title' => $section['title'],
            'description' => 'Szkielet panelu sklepu KEIKA.',
            'is_admin' => true,
            'body_class' => 'page-shell page-admin',
            'data' => [
                'section_key' => $sectionKey,
                'section' => $section,
                'sections' => $adminSections,
            ],
        ];
    }
}

return [
    'site' => $site,
    'route' => $route,
    'request' => [
        'path' => $path,
        'uri' => $requestUri,
    ],
    'catalog_products' => $catalogProducts,
];
