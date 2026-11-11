(function () {
  'use strict';

  let installPrompt = null;

  function statusElement() {
    return document.getElementById('v18NetworkStatus');
  }

  function updateNetworkStatus() {
    const element = statusElement();
    if (!element) return;
    if (navigator.onLine) {
      element.textContent = '';
      element.classList.remove('offline');
    } else {
      element.textContent = 'オフラインです。保存済みの学習画面を利用できます。';
      element.classList.add('offline');
    }
  }

  function installHelpHtml() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      return '<p>Safariでこのページを開き、画面下の共有ボタンを押します。</p>' +
        '<ol><li>「ホーム画面に追加」を選ぶ</li><li>右上の「追加」を押す</li></ol>' +
        '<p class="warning">独自ドメインへ移行する前に、ホームの「バックアップ」から学習履歴を保存してください。</p>';
    }
    return '<p>ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。</p>' +
      '<p>インストールの確認画面が表示された場合は「インストール」を押します。</p>' +
      '<p class="warning">独自ドメインへ移行する前に、ホームの「バックアップ」から学習履歴を保存してください。</p>';
  }

  window.v18OpenInstallHelp = function () {
    if (typeof window.v13Open === 'function') {
      window.v13Open('スマートフォンに追加する', installHelpHtml());
      return;
    }
    window.alert('ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。');
  };

  window.v18InstallApp = async function () {
    if (!installPrompt) {
      window.v18OpenInstallHelp();
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  };

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', function () {
    installPrompt = null;
  });
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  window.addEventListener('DOMContentLoaded', updateNetworkStatus);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').catch(function (error) {
        console.warn('Service worker registration failed:', error);
      });
    });
  }
}());
