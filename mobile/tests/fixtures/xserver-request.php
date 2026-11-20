<?php
declare(strict_types=1);
// Test-only CLI transport. This file must never be installed on a web server.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../xserver-php/lib/service.php';
$input = json_decode((string)stream_get_contents(STDIN), true, 16, JSON_THROW_ON_ERROR);
try {
    $service = new \PassReview\Service($argv[1]);
    if (($input['testAction'] ?? '') === 'expire') {
        $db = new PDO('sqlite:' . $argv[1] . '/state.sqlite');
        $db->exec('UPDATE sessions SET expires=0');
        echo '{"ok":true}';
    } else {
        echo json_encode($service->handle($input), JSON_THROW_ON_ERROR);
    }
} catch (Throwable) {
    echo '{"status":503,"headers":{},"body":{"error":"Service unavailable"}}';
}
