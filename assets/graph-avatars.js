import {CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace} from './three.core.min.js';

// Use actual 3D sprites, not a screen overlay: depth, picking and dragging remain
// part of the graph. Only this small Three.js core is needed (same r183 as graph).
export function safeAvatarUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['yt3.ggpht.com', 'yt3.googleusercontent.com', 'i.ytimg.com'].includes(url.hostname)) return null;
    // Same YouTube channel image as the rating, sized for a sharp circular node.
    url.pathname = url.pathname.replace(/=s\d+(?=-|$)/, '=s256');
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function avatarInitials(label) {
  return String(label || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase('uk') || '▶';
}

export function createChannelAvatars({
  nodeValue = node => Number(node.weight) || 1,
  makeCanvas = () => document.createElement('canvas'),
  makeImage = () => new Image(),
} = {}) {
  const records = new Map(), images = new Map(), size = 256;
  let disposed = false, focusId = null, relatedIds = new Set();

  function draw(record) {
    if (disposed || records.get(record.id) !== record) return;
    const ctx = record.context, photo = images.get(record.url);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0c2c43'; ctx.fillRect(0, 0, size, size);
    if (photo?.status === 'ready') {
      const img = photo.image, side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    } else {
      ctx.fillStyle = '#d9f8ff'; ctx.font = '700 80px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(avatarInitials(record.label), size / 2, size / 2 + 3, size - 36);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 7, 0, Math.PI * 2);
    ctx.strokeStyle = record.id === focusId ? '#ffd25c' : '#38cfff';
    ctx.lineWidth = 6; ctx.stroke();
    record.texture.needsUpdate = true;
  }

  function imageFor(url) {
    if (!url || images.has(url)) return;
    const image = makeImage(), entry = {image, status:'loading'};
    images.set(url, entry);
    // CORS keeps CanvasTexture safe to upload to WebGL. No private proxy or
    // API credentials; blocked/unavailable photos retain their initials.
    image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer'; image.decoding = 'async';
    image.onload = () => {
      if (disposed || images.get(url) !== entry) return;
      entry.status = image.naturalWidth > 0 && image.naturalHeight > 0 ? 'ready' : 'failed';
      for (const record of records.values()) if (record.url === url) draw(record);
    };
    image.onerror = () => { entry.status = 'failed'; };
    image.src = url;
  }

  function style(record) {
    const diameter = 8 * Math.cbrt(Math.max(.01, nodeValue(record.node)) * (record.id === focusId ? 1.5 : 1));
    record.sprite.scale.set(diameter, diameter, 1);
    record.material.opacity = focusId && !relatedIds.has(record.id) && record.id !== focusId ? .18 : 1;
    record.material.depthWrite = record.material.opacity === 1;
  }

  function nodeObject(node) {
    if (disposed || node?.type !== 'channel') return undefined;
    const label = node.label || '', url = safeAvatarUrl(node.thumbnail);
    let record = records.get(node.id);
    if (!record) {
      const canvas = makeCanvas(); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return undefined;
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      const material = new SpriteMaterial({map:texture, transparent:true, alphaTest:.08, depthTest:true, depthWrite:true, toneMapped:false});
      const sprite = new Sprite(material), raycast = sprite.raycast;
      // Sprite's default square pick area includes transparent corners. Keep
      // the same circular hit area the user sees, including touch/drag picking.
      sprite.raycast = function(raycaster, intersections) {
        const hits = []; raycast.call(this, raycaster, hits);
        for (const hit of hits) if (hit.uv && (hit.uv.x - .5) ** 2 + (hit.uv.y - .5) ** 2 <= (.5 - 4 / size) ** 2) intersections.push(hit);
      };
      record = {id:node.id, node, label, url, context, texture, material, sprite};
      records.set(node.id, record); imageFor(url); draw(record);
    } else if (record.url !== url || record.label !== label) {
      record.url = url; record.label = label; imageFor(url); draw(record);
    }
    record.node = node; style(record);
    return record.sprite;
  }

  function release(record) {
    record.material.dispose(); record.texture.dispose();
    // Sprite geometry is shared by Three.js; do not dispose it per channel.
  }

  function sync(nodes) {
    if (disposed) return;
    const wanted = new Set(nodes.filter(n => n.type === 'channel').map(n => n.id));
    for (const [id, record] of records) if (!wanted.has(id)) { release(record); records.delete(id); }
    for (const node of nodes) if (node.type === 'channel') nodeObject(node);
    // Reuse downloaded photos across filters without an unbounded image cache.
    const activeUrls = new Set([...records.values()].map(record => record.url));
    for (const [url, entry] of images) if (images.size > 128 && !activeUrls.has(url)) {
      entry.image.onload = entry.image.onerror = null; images.delete(url);
    }
  }

  function setSelection(id, related = new Set()) {
    const previous = focusId; focusId = id || null; relatedIds = related;
    for (const record of records.values()) {
      style(record);
      if (record.id === previous || record.id === focusId) draw(record);
    }
  }

  function dispose() {
    disposed = true;
    for (const record of records.values()) release(record);
    for (const entry of images.values()) entry.image.onload = entry.image.onerror = null;
    records.clear(); images.clear();
  }

  return {nodeObject, sync, setSelection, dispose};
}

if (typeof window !== 'undefined') window.ChannelAvatars = {create:createChannelAvatars};
