(function (root, factory) {
  const CosmicMotion = factory();
  if (typeof module === 'object' && module.exports) module.exports = CosmicMotion;
  else root.CosmicMotion = CosmicMotion;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const wrap = (value, size) => ((value + 40) % (size + 80) + size + 80) % (size + 80) - 40;

  // Resolution-independent cloud detail, lighting and planets, generated per frame.
  class NebulaFlow {
    constructor(canvas, host) {
      this.canvas = canvas;
      this.ready = false;
      this.disposed = false;
      this.time = 0;
      this.host = host;
      try { this.gl = canvas.getContext('webgl', {alpha: false, antialias: false, depth: false, powerPreference: 'low-power'}); }
      catch (_) { this.gl = null; }
      if (!this.gl) return;
      this.lost = () => { this.ready = false; canvas.hidden = true; };
      canvas.addEventListener('webglcontextlost', this.lost);
      try {
        this.setup();
        this.ready = true;
        canvas.hidden = false;
      } catch (_) { canvas.hidden = true; this.dispose(); }
    }

    setup() {
      const gl = this.gl;
      const shader = (type, source) => {
        const result = gl.createShader(type);
        gl.shaderSource(result, source); gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
          gl.deleteShader(result); throw new Error('Backdrop shader unavailable');
        }
        return result;
      };
      this.program = gl.createProgram();
      const sources = [
        [gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}'],
        [gl.FRAGMENT_SHADER, `
          precision highp float;
          varying vec2 uv;
          uniform vec2 resolution;
          uniform float time;
          float hash(vec2 p) {
            vec3 q = fract(vec3(p.xyx) * .1031);
            q += dot(q, q.yzx + 33.33);
            return fract((q.x + q.y) * q.z);
          }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3. - 2. * f);
            return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                       mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
          }
          float cloudNoise(vec2 p) {
            float total = 0., amplitude = .5;
            for (int i = 0; i < 5; i++) {
              total += amplitude * noise(p);
              p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
              amplitude *= .5;
            }
            return total;
          }
          void main() {
            float aspect = resolution.x / resolution.y;
            vec2 p = vec2(uv.x * aspect, uv.y) * 4.;
            vec2 drift = vec2(time * .045, -time * .026);
            vec2 currents = vec2(cloudNoise(p + drift), cloudNoise(p + vec2(5.2, 1.3) - drift * .8));
            float cloud = cloudNoise(p + currents * 3.2 - drift);
            float detail = cloudNoise(p * 2.7 + currents * 4. + drift * .55);
            float band = uv.y - uv.x * .86 + .2 + sin(time * .09) * .04;
            float secondBand = uv.y - uv.x * .4 - .88;
            float envelope = exp(-band * band * 25.) + .6 * exp(-secondBand * secondBand * 38.);
            vec2 center = (uv - .5) * vec2(3.1, 3.);
            float quietCenter = 1. - .82 * exp(-dot(center, center));
            float density = smoothstep(.23, .79, cloud) * envelope * quietCenter;
            float wisps = pow(max(0., detail * 1.5 - .35), 2.);
            vec3 blue = mix(vec3(.018, .07, .19), vec3(.12, .42, .62), detail);
            vec3 violet = vec3(.19, .07, .31);
            vec3 gas = mix(blue, violet, smoothstep(.55, .94, uv.y) * .55);
            vec3 color = vec3(.006, .016, .038) + density * gas * 1.5;
            color += density * wisps * vec3(.06, .18, .24);
            // A shaded planet and inclined rings remain crisp at any viewport size.
            vec2 planet = (uv - vec2(.93, .17)) * vec2(aspect, 1.);
            vec2 inclined = mat2(.94, -.342, .342, .94) * planet;
            float ringDistance = length(inclined * vec2(1., 3.7));
            float rings = smoothstep(.205, .21, ringDistance) * (1. - smoothstep(.34, .345, ringDistance));
            float stripes = .55 + .2 * sin(ringDistance * 950.) + .1 * sin(ringDistance * 2700.);
            float d = length(planet) / .16;
            if (d > 1. || inclined.y < 0.) color += rings * stripes * vec3(.13, .24, .35) * .6;
            if (d < 1.) {
              vec3 normal = vec3(planet / .16, sqrt(max(0., 1. - d * d)));
              float light = max(0., dot(normal, normalize(vec3(-.75, .65, .55))));
              float bands = .75 + .1 * sin(normal.y * 65. + noise(normal.xy * 8. + time * .012) * 5.);
              color = mix(vec3(.004, .012, .023), vec3(.07, .23, .36), light) * bands;
              color += pow(1. - normal.z, 4.) * light * vec3(.06, .34, .54);
              if (inclined.y < 0.) color += rings * stripes * vec3(.13, .24, .35) * .65;
            }
            color += exp(-abs(d - 1.) * 90.) * vec3(.035, .12, .2);
            gl_FragColor = vec4(color, 1.);
          }
        `]
      ];
      for (const [type, source] of sources) {
        const compiled = shader(type, source);
        gl.attachShader(this.program, compiled); gl.deleteShader(compiled);
      }
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Backdrop program unavailable');
      gl.useProgram(this.program);
      this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.timeUniform = gl.getUniformLocation(this.program, 'time');
      this.resolutionUniform = gl.getUniformLocation(this.program, 'resolution');
    }

    resize(width, height) {
      // Generate detail for this screen instead of enlarging the original bitmap.
      const ratio = Math.min(this.host.devicePixelRatio || 1, 1.5, Math.sqrt(6000000 / (width * height)));
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }

    draw(time) {
      if (!this.ready || this.disposed) return;
      const gl = this.gl;
      this.time = time;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.resolutionUniform, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.timeUniform, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    dispose() {
      this.disposed = true;
      this.canvas.removeEventListener('webglcontextlost', this.lost);
      if (this.gl) {
        this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program);
      }
    }
  }

  class CosmicMotion {
    constructor(canvas, backdrop, {paused = false, host = window, random = Math.random} = {}) {
      this.canvas = canvas;
      this.backdrop = backdrop;
      this.host = host;
      this.random = random;
      this.context = canvas.getContext('2d', {alpha: true});
      this.paused = paused;
      this.hidden = host.document.hidden;
      this.suspended = false;
      this.disposed = false;
      this.frame = null;
      this.previous = null;
      this.elapsed = 0;
      this.pointer = {x: 0, y: 0};
      this.target = {x: 0, y: 0};
      this.stars = [];
      this.listeners = [];
      const nebulaCanvas = backdrop.querySelector?.('.nebula-flow');
      if (nebulaCanvas) this.nebula = new NebulaFlow(nebulaCanvas, host);
      this.tick = this.tick.bind(this);
      this.listen(host, 'resize', () => this.resize());
      this.listen(host, 'pointermove', event => {
        if (event.pointerType === 'touch' || this.paused) return;
        this.target.x = (event.clientX / this.width - .5) * 2;
        this.target.y = (event.clientY / this.height - .5) * 2;
      });
      this.listen(host.document, 'pointerleave', () => { this.target = {x: 0, y: 0}; });
      this.listen(host.document, 'visibilitychange', () => {
        this.hidden = host.document.hidden;
        this.sync();
      });
      // Keep the same scene when returning from the browser's back/forward cache.
      this.listen(host, 'pagehide', event => {
        if (!event.persisted) this.dispose();
        else { this.suspended = true; this.sync(); }
      });
      this.listen(host, 'pageshow', () => {
        this.hidden = host.document.hidden;
        this.suspended = false;
        this.sync();
      });
      this.resize();
      this.sync();
    }

    listen(target, event, callback) {
      target.addEventListener(event, callback, {passive: true});
      this.listeners.push(() => target.removeEventListener(event, callback));
    }

    resize() {
      const oldWidth = this.width, oldHeight = this.height;
      this.width = Math.max(1, this.host.innerWidth);
      this.height = Math.max(1, this.host.innerHeight);
      const ratio = Math.min(1.5, this.host.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.nebula?.resize(this.width + 80, this.height + 80);
      if (!this.context) return;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      for (const star of this.stars) {
        star.x *= this.width / oldWidth;
        star.y *= this.height / oldHeight;
      }
      const count = Math.min(360, Math.max(90, Math.round(this.width * this.height / 4200)));
      while (this.stars.length < count) {
        const depth = .2 + this.random() * .8;
        this.stars.push({
          x: this.random() * this.width, y: this.random() * this.height,
          depth, radius: .3 + depth * .7,
          phase: this.random() * Math.PI * 2,
          color: this.random() > .7 ? '#afceff' : '#e6f5ff'
        });
      }
      this.stars.length = count;
      this.draw();
    }

    setPaused(paused) { this.paused = Boolean(paused); this.sync(); }

    sync() {
      const running = !this.disposed && !this.paused && !this.hidden && !this.suspended && Boolean(this.context);
      this.canvas.dataset.motion = running ? 'running' : 'paused';
      if (running && this.frame === null) {
        this.previous = null;
        this.frame = this.host.requestAnimationFrame(this.tick);
      } else if (!running) {
        if (this.frame !== null) this.host.cancelAnimationFrame(this.frame);
        this.frame = null;
        this.previous = null;
      }
    }

    tick(timestamp) {
      this.frame = null;
      if (this.disposed || this.paused || this.hidden || this.suspended) return;
      if (this.previous === null) this.previous = timestamp;
      const delta = timestamp - this.previous;
      // Background stays at 30fps, leaving rendering capacity for the 3D graph.
      if (delta >= 1000 / 30) {
        const seconds = Math.min(delta / 1000, .1);
        this.previous = timestamp;
        this.elapsed += seconds;
        const ease = 1 - Math.exp(-seconds * 3);
        this.pointer.x += (this.target.x - this.pointer.x) * ease;
        this.pointer.y += (this.target.y - this.pointer.y) * ease;
        for (const star of this.stars) {
          // Nearby stars cross the sky faster: visible motion, not only twinkling.
          star.x = wrap(star.x + (4 + star.depth * 22) * seconds, this.width);
          star.y = wrap(star.y - (2 + star.depth * 8) * seconds, this.height);
        }
        this.draw();
      }
      this.frame = this.host.requestAnimationFrame(this.tick);
    }

    draw() {
      if (!this.context) return;
      const ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      for (const star of this.stars) {
        const x = star.x + this.pointer.x * star.depth * 22;
        const y = star.y + this.pointer.y * star.depth * 16;
        const light = .58 + .17 * Math.sin(this.elapsed * .9 + star.phase);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = light * (.3 + star.depth * .7);
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const x = Math.sin(this.elapsed / 18) * 20 - this.pointer.x * 12;
      const y = Math.sin(this.elapsed / 24) * 14 - this.pointer.y * 10;
      const scale = 1.09 + Math.sin(this.elapsed / 32) * .025;
      this.backdrop.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
      this.nebula?.draw(this.elapsed);
    }

    dispose() {
      this.disposed = true;
      this.sync();
      for (const remove of this.listeners) remove();
      this.listeners = [];
      this.nebula?.dispose();
    }
  }
  CosmicMotion.NebulaFlow = NebulaFlow;
  return CosmicMotion;
});
