<?php
declare(strict_types=1);

$site = $app['site'];
$route = $app['route'];
$request = $app['request'];
$templateFile = __DIR__ . '/pages/' . $route['template'] . '.php';

if (!is_file($templateFile)) {
    http_response_code(500);
    echo 'Brak pliku widoku: ' . h($route['template']);
    exit;
}
?><!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= h($route['title']) ?> | <?= h($site['name']) ?></title>
  <meta name="description" content="<?= h($route['description']) ?>">
  <meta name="theme-color" content="#f2f4ee">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= h(asset_url('assets/css/app.css')) ?>">
</head>
<body class="<?= h($route['body_class']) ?>" data-path="<?= h($request['path']) ?>" data-admin="<?= $route['is_admin'] ? '1' : '0' ?>">
  <?php require __DIR__ . '/partials/header.php'; ?>

  <main id="main-content" class="site-main" tabindex="-1">
    <?php require $templateFile; ?>
  </main>

  <?php require __DIR__ . '/partials/footer.php'; ?>

  <script src="<?= h(asset_url('assets/js/app.js')) ?>" defer></script>
</body>
</html>
