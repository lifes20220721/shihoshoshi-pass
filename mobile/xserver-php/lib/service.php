<?php
declare(strict_types=1);

namespace PassReview;

use PDO;
use RuntimeException;
use Throwable;

function base64url(string $bytes): string {
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function readJson(string $file, int $maxBytes = 524288): array {
    if (!is_file($file) || filesize($file) > $maxBytes) throw new RuntimeException('Invalid server file');
    $data = json_decode((string)file_get_contents($file), true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new RuntimeException('Invalid server data');
    return $data;
}

function validateIssuer(string $issuer): array {
    $url = parse_url($issuer);
    if (!$url || ($url['scheme'] ?? '') !== 'https' || empty($url['host']) ||
        isset($url['user']) || isset($url['pass']) ||
        isset($url['query']) || isset($url['fragment']) ||
        (isset($url['port']) && $url['port'] !== 443) ||
        !preg_match('/^[a-z0-9.-]+$/D', $url['host']) ||
        !preg_match('~^/[a-zA-Z0-9/_-]+$~D', $url['path'] ?? '') ||
        str_ends_with($issuer, '/') || str_contains($url['path'], '//')) {
        throw new RuntimeException('A canonical HTTPS endpoint with a dedicated path is required');
    }
    return $url;
}

final class Service {
    private PDO $db;
    private array $config;
    private string $key;
    private string $accountFile;
    private array $url;

    public function __construct(string $privateDirectory) {
        if (PHP_VERSION_ID < 80300 || !extension_loaded('sodium') ||
            !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            throw new RuntimeException('PHP 8.3+, sodium and PDO SQLite required');
        }
        $dir = realpath($privateDirectory);
        if ($dir === false || !is_dir($dir)) throw new RuntimeException('Private directory required');
        // Never allow a secret/config/state directory within a public document root.
        if (preg_match('~(?:^|/)public_html(?:/|$)~', $dir)) throw new RuntimeException('Secrets must be outside public_html');
        $documentRoot = empty($_SERVER['DOCUMENT_ROOT']) ? false : realpath($_SERVER['DOCUMENT_ROOT']);
        if ($documentRoot && ($dir === $documentRoot || str_starts_with($dir, $documentRoot . '/'))) {
            throw new RuntimeException('Secrets must be outside the document root');
        }
        $this->config = readJson($dir . '/server.json', 65536);
        $this->url = validateIssuer($this->config['issuer'] ?? '');
        if (($this->config['audience'] ?? '') !== 'com.shihoshoshipass.app' ||
            !is_string($this->config['keyId'] ?? null) || $this->config['keyId'] === '' ||
            !is_array($this->config['origins'] ?? null) ||
            !is_string($this->config['dummyPasswordHash'] ?? null) ||
            !str_starts_with($this->config['dummyPasswordHash'], '$argon2id$')) {
            throw new RuntimeException('Invalid service configuration');
        }
        foreach ($this->config['origins'] as $origin) {
            if (!is_string($origin) || !preg_match('~^https://[a-zA-Z0-9.-]+(?::[0-9]+)?$~D', $origin)) {
                throw new RuntimeException('Invalid CORS origin');
            }
        }
        $key = file_get_contents($dir . '/signing.key');
        if (!is_string($key) || strlen($key) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES) throw new RuntimeException('Invalid signing key');
        $this->key = $key;
        $this->accountFile = $dir . '/accounts.json';
        $this->accounts();
        // CGI workers share an atomic durable store, unlike the Node Map backend.
        $oldMask = umask(0077);
        try {
            $this->db = new PDO('sqlite:' . $dir . '/state.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $this->db->exec('PRAGMA busy_timeout=2000');
            $this->db->exec('PRAGMA journal_mode=WAL');
            $this->db->exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, id TEXT NOT NULL, account_id TEXT NOT NULL, nonce TEXT NOT NULL, expires INTEGER NOT NULL, password_version TEXT NOT NULL)');
            $this->db->exec('CREATE TABLE IF NOT EXISTS limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
            $this->db->exec('CREATE TABLE IF NOT EXISTS leases (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
        } finally { umask($oldMask); }
    }

    private function accounts(): array {
        $items = readJson($this->accountFile);
        if (!array_is_list($items)) throw new RuntimeException('Invalid account store');
        $ids = []; $users = [];
        foreach ($items as $item) {
            if (!is_array($item) || !is_string($item['id'] ?? null) || $item['id'] === '' ||
                !is_string($item['username'] ?? null) || !preg_match('/^[a-z0-9@._+-]{3,100}$/D', $item['username']) ||
                !is_string($item['passwordHash'] ?? null) || !str_starts_with($item['passwordHash'], '$argon2id$') ||
                isset($ids[$item['id']]) || isset($users[$item['username']])) {
                throw new RuntimeException('Invalid account store');
            }
            $ids[$item['id']] = true; $users[$item['username']] = true;
        }
        return $items;
    }

    private function allowed(?array $account, int $now): bool {
        $expiry = is_string($account['validUntil'] ?? null) ? strtotime($account['validUntil']) : false;
        return $account !== null && ($account['enabled'] ?? null) === true &&
            ($account['role'] ?? '') === 'play_reviewer' && is_array($account['apps'] ?? null) &&
            in_array($this->config['audience'], $account['apps'], true) && $expiry !== false && $expiry > $now;
    }

    private function query(string $sql, array $values = []): \PDOStatement {
        $statement = $this->db->prepare($sql); $statement->execute($values); return $statement;
    }

    private function atomic(callable $operation): mixed {
        $this->db->exec('BEGIN IMMEDIATE');
        try { $result = $operation(); $this->db->exec('COMMIT'); return $result; }
        catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    private function prune(int $now): void {
        foreach (['sessions', 'limits', 'leases'] as $table) $this->query("DELETE FROM $table WHERE expires<=?", [$now]);
    }

    private function reserveLogin(string $ip, string $username, int $now): array {
        return $this->atomic(function () use ($ip, $username, $now) {
            $this->prune($now);
            if ((int)$this->db->query('SELECT COUNT(*) FROM leases')->fetchColumn() >= 4 ||
                (int)$this->db->query('SELECT COUNT(*) FROM sessions')->fetchColumn() >= 1000 ||
                (int)$this->db->query('SELECT COUNT(*) FROM limits')->fetchColumn() >= 10000) return [503, null];
            $counts = [];
            foreach (['ip:' . hash('sha256', $ip), 'pair:' . hash('sha256', $ip . "\0" . $username)] as $id) {
                $this->query('INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1', [$id, $now+900]);
                $counts[] = (int)$this->query('SELECT count FROM limits WHERE id=?', [$id])->fetchColumn();
            }
            if ($counts[0] > 30 || $counts[1] > 5) return [429, null];
            $lease = bin2hex(random_bytes(16));
            $this->query('INSERT INTO leases(id,expires) VALUES(?,?)', [$lease, $now+30]);
            return [200, $lease];
        });
    }

    private function grant(array $account, array $session, int $now): string {
        $exp = min($now+120, (int)strtotime($account['validUntil']), (int)$session['expires']);
        if ($exp <= $now) throw new RuntimeException('Grant expired');
        $header = base64url(json_encode(['alg'=>'EdDSA', 'typ'=>'JWT', 'kid'=>$this->config['keyId']], JSON_THROW_ON_ERROR));
        $payload = base64url(json_encode(['iss'=>$this->config['issuer'], 'aud'=>$this->config['audience'],
            'sub'=>$account['id'], 'sid'=>$session['id'], 'role'=>'play_reviewer', 'scope'=>'study:all',
            'nonce'=>$session['nonce'], 'iat'=>$now, 'exp'=>$exp], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        $input = $header . '.' . $payload;
        return $input . '.' . base64url(sodium_crypto_sign_detached($input, $this->key));
    }

    /** Pure request/response boundary for CLI integration tests; no network test is implied. */
    public function handle(array $request): array {
        $headers = ['Cache-Control'=>'no-store', 'Content-Type'=>'application/json', 'X-Content-Type-Options'=>'nosniff'];
        $reply = static fn(int $status, array $body = []): array => ['status'=>$status, 'headers'=>$headers, 'body'=>$body];
        if (($request['https'] ?? false) !== true) return $reply(426, ['error'=>'HTTPS required']);
        $host = strtolower($request['host'] ?? '');
        if ($host !== $this->url['host'] && $host !== $this->url['host'] . ':443') return $reply(400, ['error'=>'Invalid host']);
        $origin = $request['headers']['origin'] ?? '';
        if ($origin !== '' && !in_array($origin, $this->config['origins'], true)) return $reply(403, ['error'=>'Access denied']);
        if ($origin !== '') {
            $headers += ['Access-Control-Allow-Origin'=>$origin, 'Vary'=>'Origin',
                'Access-Control-Allow-Headers'=>'Content-Type,Authorization', 'Access-Control-Allow-Methods'=>'POST,OPTIONS'];
        }
        $reply = static fn(int $status, array $body = []): array => ['status'=>$status, 'headers'=>$headers, 'body'=>$body];
        $path = parse_url($request['path'] ?? '', PHP_URL_PATH);
        $prefix = $this->url['path'];
        $route = is_string($path) && str_starts_with($path, $prefix . '/') ? substr($path, strlen($prefix)) : '';
        $method = $request['method'] ?? '';
        if ($route === '/healthz' && in_array($method, ['GET', 'HEAD'], true)) return $reply(200, ['ok'=>true]);
        if (!in_array($route, ['/login', '/grant', '/logout'], true)) return $reply(404, ['error'=>'Not found']);
        if ($method === 'OPTIONS') return $reply(204);
        if ($method !== 'POST') return $reply(405, ['error'=>'POST required']);
        if (explode(';', $request['headers']['content-type'] ?? '')[0] !== 'application/json') return $reply(415, ['error'=>'JSON required']);
        $raw = $request['body'] ?? '';
        if (!is_string($raw) || strlen($raw) > 8192) return $reply(413, ['error'=>'Too large']);
        try {
            $decoded = json_decode($raw, false, 16, JSON_THROW_ON_ERROR);
            if (!is_object($decoded)) return $reply(400, ['error'=>'Invalid request']);
            $body = (array)$decoded;
            $now = time(); $this->prune($now);
            if ($route === '/login') {
                $username = is_string($body['username'] ?? null) ? strtolower(trim($body['username'])) : '';
                if (!preg_match('/^[a-z0-9@._+-]{3,100}$/D', $username) || !is_string($body['password'] ?? null) ||
                    strlen($body['password']) > 256 || !is_string($body['nonce'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $body['nonce'])) {
                    return $reply(401, ['error'=>'Access denied']);
                }
                // Peer only. Forwarded and X-Forwarded-For never select limiter keys.
                [$status, $lease] = $this->reserveLogin($request['ip'] ?? 'unknown', $username, $now);
                if ($status !== 200) return $reply($status, ['error'=>'Try later']);
                try {
                    $account = null;
                    foreach ($this->accounts() as $item) if ($item['username'] === $username) { $account = $item; break; }
                    $ok = sodium_crypto_pwhash_str_verify($account['passwordHash'] ?? $this->config['dummyPasswordHash'], $body['password']);
                    if (!$ok || !$this->allowed($account, $now)) return $reply(401, ['error'=>'Access denied']);
                    $token = base64url(random_bytes(32));
                    $session = ['id'=>bin2hex(random_bytes(16)), 'account_id'=>$account['id'],
                        'nonce'=>$body['nonce'], 'expires'=>$now+28800, 'password_version'=>hash('sha256', $account['passwordHash'])];
                    $this->atomic(function () use ($token, $session) {
                        if ((int)$this->db->query('SELECT COUNT(*) FROM sessions')->fetchColumn() >= 1000) throw new RuntimeException('Session limit');
                        $this->query('INSERT INTO sessions(hash,id,account_id,nonce,expires,password_version) VALUES(?,?,?,?,?,?)',
                            [hash('sha256', $token), $session['id'], $session['account_id'], $session['nonce'], $session['expires'], $session['password_version']]);
                    });
                    return $reply(200, ['session'=>$token, 'grant'=>$this->grant($account, $session, $now)]);
                } finally { $this->query('DELETE FROM leases WHERE id=?', [$lease]); }
            }
            $auth = $request['headers']['authorization'] ?? '';
            if (!preg_match('/^Bearer ([A-Za-z0-9_-]{43})$/D', $auth, $matches)) return $reply(401, ['error'=>'Access denied']);
            $digest = hash('sha256', $matches[1]);
            $session = $this->query('SELECT * FROM sessions WHERE hash=?', [$digest])->fetch(PDO::FETCH_ASSOC);
            if (!$session) return $reply(401, ['error'=>'Access denied']);
            if ($route === '/logout') {
                $this->query('DELETE FROM sessions WHERE hash=?', [$digest]); return $reply(200, ['ok'=>true]);
            }
            $account = null;
            foreach ($this->accounts() as $item) if ($item['id'] === $session['account_id']) { $account = $item; break; }
            if (!$this->allowed($account, $now) || ($body['nonce'] ?? '') !== $session['nonce'] ||
                !hash_equals($session['password_version'], hash('sha256', $account['passwordHash']))) {
                $this->query('DELETE FROM sessions WHERE hash=?', [$digest]); return $reply(401, ['error'=>'Access denied']);
            }
            return $reply(200, ['grant'=>$this->grant($account, $session, $now)]);
        } catch (\JsonException) { return $reply(400, ['error'=>'Invalid request']); }
        catch (Throwable) { return $reply(503, ['error'=>'Service unavailable']); }
    }
}
