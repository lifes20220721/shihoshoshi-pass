<?php
declare(strict_types=1);

// This entry point is the ONLY PHP program placed in public_html/pass-review.
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
try {
    $privateDirectory = dirname(__DIR__, 2) . '/pass-review-private';
    require $privateDirectory . '/service.php';
    $service = new \PassReview\Service($privateDirectory);
    $headers = [];
    foreach (['CONTENT_TYPE'=>'content-type', 'HTTP_ORIGIN'=>'origin', 'HTTP_AUTHORIZATION'=>'authorization',
        'REDIRECT_HTTP_AUTHORIZATION'=>'authorization'] as $serverKey=>$key) {
        if (isset($_SERVER[$serverKey]) && !isset($headers[$key])) $headers[$key] = $_SERVER[$serverKey];
    }
    // Do not trust forwarded scheme or IP headers supplied by arbitrary clients.
    $result = $service->handle(['https'=>in_array($_SERVER['HTTPS'] ?? '', ['on','1'], true),
        'host'=>$_SERVER['HTTP_HOST'] ?? '', 'ip'=>$_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'method'=>$_SERVER['REQUEST_METHOD'] ?? '', 'path'=>$_SERVER['REQUEST_URI'] ?? '',
        'headers'=>$headers, 'body'=>(string)file_get_contents('php://input', false, null, 0, 8193)]);
    http_response_code($result['status']);
    foreach ($result['headers'] as $name=>$value) header($name . ': ' . $value);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD' && $result['status'] !== 204) {
        echo json_encode($result['body'], JSON_THROW_ON_ERROR);
    }
} catch (Throwable) {
    http_response_code(503); echo '{"error":"Service unavailable"}';
}
