'use strict';

// 表示を許す Gist の持ち主と、読むファイル名
const OWNER = 'rxsxkxd';
const FILE = 'data.json';

const app = document.getElementById('app');

// URL の #id=<GistID> から ID を取る
function getGistId() {
  const id = new URLSearchParams(location.hash.slice(1)).get('id');
  return id && /^[0-9a-f]+$/i.test(id) ? id : null;
}

async function fetchGist(id) {
  const res = await fetch(`https://api.github.com/gists/${id}`);
  if (!res.ok) throw new Error(`Gist を取得できません (HTTP ${res.status})`);
  return res.json();
}

// 持ち主を確かめてから、ファイルの中身を返す
async function readFile(gist) {
  if (gist.owner?.login !== OWNER) throw new Error('表示できない Gist です');

  const file = gist.files[FILE];
  if (!file) throw new Error(`${FILE} が見つかりません`);
  if (!file.truncated) return file.content;

  // 1MB を超えると content が切り詰められるので、raw_url から取り直す
  const res = await fetch(file.raw_url);
  if (!res.ok) throw new Error(`${FILE} を取得できません (HTTP ${res.status})`);
  return res.text();
}

// 描画はすべて textContent で行う（innerHTML は使わない）
function render(data) {
  const h1 = document.createElement('h1');
  h1.textContent = data.title ?? 'データビューア';

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);

  app.replaceChildren(h1, pre);
}

function showMessage(text, isError = false) {
  const p = document.createElement('p');
  p.className = isError ? 'message error' : 'message';
  p.textContent = text;
  app.replaceChildren(p);
}

async function main() {
  const id = getGistId();
  if (!id) {
    showMessage('URL に #id=<GistID> を指定してください', true);
    return;
  }

  showMessage('読み込み中...');
  try {
    const gist = await fetchGist(id);
    const content = await readFile(gist);
    render(JSON.parse(content));
  } catch (err) {
    showMessage(`読み込みエラー: ${err.message}`, true);
  }
}

window.addEventListener('hashchange', main);
main();
