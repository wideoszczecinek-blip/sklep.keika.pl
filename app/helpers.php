<?php
declare(strict_types=1);

function h(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function shop_url(string $path = '/'): string
{
    if ($path === '') {
        $path = '/';
    }
    if ($path[0] !== '/') {
        $path = '/' . $path;
    }
    return $path;
}

function asset_url(string $relativePath): string
{
    $relativePath = ltrim($relativePath, '/');
    $fullPath = __DIR__ . '/../' . $relativePath;
    $version = is_file($fullPath) ? (string)filemtime($fullPath) : (string)time();
    return '/' . $relativePath . '?v=' . rawurlencode($version);
}

function is_active_route(string $currentPath, string $routePathPrefix): bool
{
    $current = rtrim($currentPath, '/');
    $prefix = rtrim($routePathPrefix, '/');

    if ($current === '') {
        $current = '/';
    }
    if ($prefix === '') {
        $prefix = '/';
    }
    if ($prefix === '/') {
        return $current === '/';
    }

    return $current === $prefix || str_starts_with($current, $prefix . '/');
}

function format_money_pln(float $value): string
{
    return number_format($value, 2, ',', ' ') . ' zł';
}
