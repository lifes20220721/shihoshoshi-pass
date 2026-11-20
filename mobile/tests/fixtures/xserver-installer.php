<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../../xserver-php/installer-core.php';
$spec=json_decode((string)file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR);
$request=json_decode((string)stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);
try{
    $installer=new \PassReviewSetup\Installer($spec,$argv[2]);
    echo json_encode($installer->handle($request),JSON_THROW_ON_ERROR);
}catch(Throwable){echo '{"status":503,"body":{"error":"Setup unavailable"}}';}
