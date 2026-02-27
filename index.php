<?php
declare(strict_types=1);

$app = require __DIR__ . '/app/bootstrap.php';

http_response_code((int)($app['route']['status'] ?? 200));

require __DIR__ . '/views/layout.php';
