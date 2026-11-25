<?php
declare(strict_types=1);
namespace PassReviewSetup;

use RuntimeException;
use Throwable;

function encode(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
function decode(string $value): string {
    if (!preg_match('/^[A-Za-z0-9_-]+$/D', $value)) throw new RuntimeException('Invalid encoding');
    $bytes = base64_decode(strtr($value, '-_', '+/'), true);
    if ($bytes === false || encode($bytes) !== $value) throw new RuntimeException('Invalid encoding');
    return $bytes;
}

final class Conflict extends RuntimeException {}

final class Installer {
    private string $root;
    private string $parent;
    private string $stateDir;
    private string $filename;

    public function __construct(private array $spec, string $publicDirectory) {
        $root = realpath($publicDirectory);
        if ($root === false || basename($root) !== 'public_html') throw new RuntimeException('Upload to public_html');
        if (!preg_match('/^[a-f0-9]{32}$/D', $spec['id'] ?? '') ||
            ($spec['issuer'] ?? '') !== 'https://xs968799.xsrv.jp/pass-review' ||
            !is_int($spec['expiresAt'] ?? null) ||
            !preg_match('/^[a-f0-9]{64}$/D', $spec['signingPublicKey'] ?? '') ||
            !preg_match('/^[a-f0-9]{64}$/D', $spec['encryptionPublicKey'] ?? '') ||
            !preg_match('/^[a-f0-9]{64}$/D', $spec['manifestHash'] ?? '')) throw new RuntimeException('Invalid installation spec');
        $this->root = $root;
        $this->parent = dirname($root);
        $this->stateDir = $this->parent . '/pass-review-setup-' . $spec['id'];
        $this->filename = 'pass-review-connect-' . $spec['id'] . '.php';
    }

    private function requirements(): array {
        return ['php'=>PHP_VERSION_ID >= 80300,
            'sodium'=>function_exists('sodium_crypto_sign_verify_detached') && function_exists('sodium_crypto_pwhash_str'),
            'sqlite'=>class_exists('PDO') && in_array('sqlite', \PDO::getAvailableDrivers(), true),
            'openssl'=>function_exists('openssl_encrypt') && function_exists('hash_hkdf')];
    }

    private function save(string $file, array|string $data, int $mode = 0600): void {
        $data = is_array($data) ? json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) : $data;
        $temp = $file . '.tmp-' . bin2hex(random_bytes(8));
        $handle = fopen($temp, 'x');
        if (!$handle) throw new RuntimeException('Cannot create installation file');
        try {
            chmod($temp, $mode);
            if (fwrite($handle, $data) !== strlen($data)) throw new RuntimeException('Incomplete installation file');
            fflush($handle);
        } finally { fclose($handle); }
        if (!rename($temp, $file)) throw new RuntimeException('Cannot commit installation file');
    }

    private function state(): array {
        $file = $this->stateDir . '/state.json';
        if (!is_file($file)) return ['phase'=>'new', 'nonces'=>[]];
        if (is_link($file) || filesize($file) > 131072) throw new RuntimeException('Invalid setup state');
        $state = json_decode((string)file_get_contents($file), true, 24, JSON_THROW_ON_ERROR);
        if (!is_array($state) || !isset($state['phase'], $state['nonces'])) throw new RuntimeException('Invalid setup state');
        return $state;
    }

    private function authenticated(array $request, int $now): ?array {
        try {
            $envelope = json_decode($request['body'] ?? '', true, 8, JSON_THROW_ON_ERROR);
            $payload = decode($envelope['payload'] ?? '');
            $signature = decode($envelope['signature'] ?? '');
            if (strlen($signature) !== 64 || !sodium_crypto_sign_verify_detached($signature, $payload, hex2bin($this->spec['signingPublicKey']))) return null;
            $claims = json_decode($payload, true, 8, JSON_THROW_ON_ERROR);
            if (!is_array($claims) || count($claims) !== 6 ||
                ($claims['id'] ?? '') !== $this->spec['id'] ||
                ($claims['manifestHash'] ?? '') !== $this->spec['manifestHash'] ||
                !in_array($claims['action'] ?? '', ['install','result','finish'], true) ||
                !is_int($claims['iat'] ?? null) || !is_int($claims['exp'] ?? null) ||
                $claims['iat'] > $now+30 || $claims['exp'] <= $now ||
                $claims['exp'] <= $claims['iat'] || $claims['exp']-$claims['iat'] > 120 ||
                !is_string($claims['nonce'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $claims['nonce'])) return null;
            return $claims;
        } catch (Throwable) { return null; }
    }

    private function install(): array {
        $names = ['private/service.php', 'public/index.php', 'public/.htaccess'];
        if (array_keys($this->spec['files'] ?? []) !== $names) throw new RuntimeException('Unexpected bundled files');
        $files = [];
        foreach ($names as $name) {
            $item = $this->spec['files'][$name];
            $bytes = base64_decode($item['data'], true);
            if ($bytes === false || !hash_equals($item['sha256'], hash('sha256', $bytes))) throw new RuntimeException('Bundled file hash mismatch');
            $files[$name] = $bytes;
        }
        $private = $this->parent . '/pass-review-private';
        $public = $this->root . '/pass-review';
        // Existing directories, files and symlinks are never replaced.
        if (file_exists($private) || is_link($private) || file_exists($public) || is_link($public)) throw new Conflict('Target already exists');
        $stage = $this->stateDir . '/staging';
        if (!mkdir($stage, 0700) || !mkdir($stage . '/private', 0700) || !mkdir($stage . '/public', 0755)) throw new RuntimeException('Cannot stage installation');
        $this->save($stage . '/private/service.php', $files['private/service.php']);
        $this->save($stage . '/public/index.php', $files['public/index.php'], 0644);
        $this->save($stage . '/public/.htaccess', $files['public/.htaccess'], 0644);
        chmod($stage . '/public', 0755);
        $pair = sodium_crypto_sign_keypair(); $keyId = bin2hex(random_bytes(16));
        $password = encode(random_bytes(24)); $accountId = bin2hex(random_bytes(16));
        $hash = sodium_crypto_pwhash_str($password, SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE, SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE);
        $dummy = sodium_crypto_pwhash_str(encode(random_bytes(32)), SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE, SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE);
        $validUntil = gmdate('c', time()+180*86400);
        $config = ['issuer'=>$this->spec['issuer'], 'audience'=>'com.shihoshoshipass.app',
            'keyId'=>$keyId, 'origins'=>['https://localhost'], 'dummyPasswordHash'=>$dummy];
        $account = ['id'=>$accountId, 'username'=>'play-reviewer', 'passwordHash'=>$hash, 'enabled'=>true,
            'role'=>'play_reviewer', 'apps'=>[$config['audience']], 'validUntil'=>$validUntil];
        $client = ['enabled'=>true, 'endpoint'=>$config['issuer'], 'issuer'=>$config['issuer'],
            'audience'=>$config['audience'], 'keyId'=>$keyId,
            'publicKey'=>['kty'=>'OKP','crv'=>'Ed25519','x'=>encode(sodium_crypto_sign_publickey($pair))]];
        $this->save($stage . '/private/signing.key', sodium_crypto_sign_secretkey($pair));
        $this->save($stage . '/private/server.json', $config);
        $this->save($stage . '/private/accounts.json', [$account]);
        $this->save($stage . '/private/client-public.json', $client);
        require $stage . '/private/service.php';
        $service = new \PassReview\Service($stage . '/private');
        $health = $service->handle(['https'=>true, 'host'=>'xs968799.xsrv.jp', 'method'=>'GET', 'path'=>'/pass-review/healthz']);
        if ($health['status'] !== 200) throw new RuntimeException('Staged service check failed');
        unset($service);

        // Encrypt reviewer credentials to this installation's operator. They are
        // never returned or stored as plaintext by the HTTP installer.
        $ephemeral = sodium_crypto_box_keypair(); $salt = random_bytes(32); $iv = random_bytes(12);
        $shared = sodium_crypto_scalarmult(sodium_crypto_box_secretkey($ephemeral), hex2bin($this->spec['encryptionPublicKey']));
        $key = hash_hkdf('sha256', $shared, 32, 'pass-review-credentials:v1:' . $this->spec['id'], $salt);
        $plaintext = json_encode(['username'=>$account['username'], 'password'=>$password, 'accountId'=>$accountId, 'validUntil'=>$validUntil], JSON_THROW_ON_ERROR);
        $aad = $this->spec['id'] . ':' . $this->spec['manifestHash'];
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $aad, 16);
        if ($cipher === false) throw new RuntimeException('Credential encryption failed');
        $result = ['installerId'=>$this->spec['id'], 'manifestHash'=>$this->spec['manifestHash'], 'clientPublic'=>$client,
            'credentials'=>['algorithm'=>'X25519-HKDF-SHA256-AES256GCM', 'publicKey'=>encode(sodium_crypto_box_publickey($ephemeral)),
                'salt'=>encode($salt), 'iv'=>encode($iv), 'tag'=>encode($tag), 'ciphertext'=>encode($cipher)]];
        sodium_memzero($password); sodium_memzero($plaintext); sodium_memzero($key); sodium_memzero($shared);
        // Recoverable encrypted receipt exists before exposing the public routes.
        $this->save($this->stateDir . '/receipt.json', $result);
        if (!rename($stage . '/private', $private)) throw new RuntimeException('Cannot commit private service');
        if (!rename($stage . '/public', $public)) throw new RuntimeException('Cannot commit public service');
        return $result;
    }

    public function handle(array $request): array {
        $reply = static fn(int $status, array $body): array => ['status'=>$status,'body'=>$body];
        if (($request['https'] ?? false) !== true) return $reply(426, ['error'=>'HTTPS required']);
        if (!in_array(strtolower($request['host'] ?? ''), ['xs968799.xsrv.jp','xs968799.xsrv.jp:443'], true)) return $reply(400, ['error'=>'Invalid host']);
        if (($request['path'] ?? '') !== '/' . $this->filename) return $reply(404, ['error'=>'Not found']);
        $now = time();
        if ($this->spec['expiresAt'] <= $now) return $reply(410, ['error'=>'Setup expired']);
        $requirements = $this->requirements();
        if (($request['method'] ?? '') === 'GET') {
            try { if ($this->state()['phase'] === 'closed') return $reply(410, ['error'=>'Setup closed']); }
            catch (Throwable) { return $reply(503, ['error'=>'Setup unavailable']); }
            return $reply(200, ['installerId'=>$this->spec['id'], 'manifestHash'=>$this->spec['manifestHash'],
                'ready'=>!in_array(false, $requirements, true), 'requirements'=>$requirements]);
        }
        if (($request['method'] ?? '') !== 'POST') return $reply(405, ['error'=>'POST required']);
        if (in_array(false, $requirements, true)) return $reply(503, ['error'=>'Required PHP features unavailable']);
        if (($request['contentType'] ?? '') !== 'application/json') return $reply(415, ['error'=>'JSON required']);
        if (!is_string($request['body'] ?? null) || strlen($request['body']) > 4096) return $reply(413, ['error'=>'Too large']);
        $claims = $this->authenticated($request, $now);
        if (!$claims) return $reply(401, ['error'=>'Access denied']);
        $mask = umask(0077); $lock = null;
        try {
            if (is_link($this->stateDir)) throw new RuntimeException('Invalid setup directory');
            if (!is_dir($this->stateDir) && !@mkdir($this->stateDir, 0700)) {
                // Another authenticated request may create it before this request acquires the lock.
                clearstatcache(true, $this->stateDir);
                if (!is_dir($this->stateDir)) throw new RuntimeException('Cannot create setup directory');
            }
            if (is_link($this->stateDir)) throw new RuntimeException('Invalid setup directory');
            $lock = fopen($this->stateDir . '/lock', 'c');
            if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Cannot lock setup');
            $state = $this->state();
            if ($state['phase'] === 'closed') return $reply(410, ['error'=>'Setup closed']);
            foreach ($state['nonces'] as $nonce=>$expiry) if ($expiry <= $now) unset($state['nonces'][$nonce]);
            if (isset($state['nonces'][$claims['nonce']])) return $reply(409, ['error'=>'Request already used']);
            if (count($state['nonces']) >= 128) return $reply(429, ['error'=>'Try later']);
            $state['nonces'][$claims['nonce']] = $claims['exp'];
            $this->save($this->stateDir . '/state.json', $state);
            if ($claims['action'] === 'finish') {
                if ($state['phase'] !== 'installed') return $reply(409, ['error'=>'Installation not complete']);
                $state['phase'] = 'closed'; $this->save($this->stateDir . '/state.json', $state);
                $self = $this->root . '/' . $this->filename;
                $removed = !file_exists($self) || (!is_link($self) && unlink($self));
                return $reply(200, ['closed'=>true,'removed'=>$removed]);
            }
            if ($state['phase'] === 'installed') return $reply(200, $state['result']);
            if ($claims['action'] !== 'install' || $state['phase'] !== 'new') return $reply(409, ['error'=>'Installation unavailable']);
            $state['phase'] = 'installing'; $this->save($this->stateDir . '/state.json', $state);
            try {
                $result = $this->install();
                $state['phase'] = 'installed'; $state['result'] = $result;
                $this->save($this->stateDir . '/state.json', $state);
                return $reply(200, $result);
            } catch (Throwable $error) {
                $state['phase'] = 'failed'; $this->save($this->stateDir . '/state.json', $state);
                if ($error instanceof Conflict) return $reply(409, ['error'=>'Target exists; existing files were preserved']);
                return $reply(503, ['error'=>'Installation stopped; check the private setup state']);
            }
        } catch (Throwable) { return $reply(503, ['error'=>'Setup unavailable']); }
        finally { if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); } umask($mask); }
    }
}
