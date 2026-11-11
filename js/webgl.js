/* =========================================================
   Liquid noise background — raw WebGL, no libraries.
   A domain-warped fbm field that drifts over time, bends
   toward the pointer and dims as you scroll past the hero.
   Exposes window.VNGL = { setIntro(v) } for the intro timeline.
   ========================================================= */
(() => {
    const canvas = document.getElementById('gl');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: false,
    });

    if (!gl) {
        canvas.remove();
        return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const vertexSrc = `
        attribute vec2 aPos;
        void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    const fragmentSrc = `
        precision highp float;
        uniform vec2  uRes;
        uniform float uTime;
        uniform vec2  uMouse;
        uniform float uScroll;
        uniform float uIntro;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
            for (int i = 0; i < 5; i++) {
                v += a * noise(p);
                p = m * p;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / uRes;
            float aspect = uRes.x / uRes.y;
            vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
            vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);

            float t = uTime * 0.05;

            // pointer pushes the field around
            vec2 toMouse = p - m;
            float md = length(toMouse);
            p += normalize(toMouse + 1e-4) * 0.08 * exp(-md * md * 5.0);

            // domain warping
            vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)),
                          fbm(p * 1.3 + vec2(5.2, 1.3) - t));
            vec2 r = vec2(fbm(p * 1.2 + 2.2 * q + vec2(1.7, 9.2) + t * 1.4),
                          fbm(p * 1.2 + 2.2 * q + vec2(8.3, 2.8) - t * 1.1));
            float f = fbm(p * 1.1 + 2.4 * r);

            // shape: keep the energy on the right / lower side, away from the headline
            vec2 c = vec2(aspect * 0.28, -0.12);
            float mask = smoothstep(1.25, 0.0, length((p - c) * vec2(0.8, 1.05)));
            mask = max(mask, 0.22);

            vec3 base   = vec3(0.039, 0.039, 0.043);
            vec3 indigo = vec3(0.26, 0.20, 0.85);
            vec3 cyan   = vec3(0.13, 0.83, 0.93);

            // stretch the fbm range so the colour bands actually show up
            float g = clamp((f - 0.25) * 1.9, 0.0, 1.0);
            float h = clamp((f * 1.1 + length(q) * 0.35 - 0.62) * 2.4, 0.0, 1.0);

            vec3 col = base;
            col = mix(col, indigo * 0.8, smoothstep(0.15, 0.85, g) * mask);
            col = mix(col, cyan * 0.9, smoothstep(0.2, 1.0, h) * mask * 0.85);
            col += cyan * 0.07 * exp(-md * md * 7.0);   // soft pointer glow

            // vignette
            col *= smoothstep(1.45, 0.3, length(uv - 0.5) * 1.3);

            // intro fade-in and scroll dimming
            float strength = uIntro * (1.0 - 0.8 * uScroll);
            col = mix(base, col, strength);

            // fine grain
            col += (hash(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5) * 0.03;

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function compile(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn('[webgl] shader error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) {
        canvas.remove();
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[webgl] link error:', gl.getProgramInfoLog(program));
        canvas.remove();
        return;
    }
    gl.useProgram(program);

    // Fullscreen triangle
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
        res: gl.getUniformLocation(program, 'uRes'),
        time: gl.getUniformLocation(program, 'uTime'),
        mouse: gl.getUniformLocation(program, 'uMouse'),
        scroll: gl.getUniformLocation(program, 'uScroll'),
        intro: gl.getUniformLocation(program, 'uIntro'),
    };

    // Render at reduced resolution — the field is soft, so upscaling is invisible and cheap.
    const RES_SCALE = 0.5;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(window.innerWidth * dpr * RES_SCALE));
        const h = Math.max(1, Math.floor(window.innerHeight * dpr * RES_SCALE));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
        gl.uniform2f(u.res, w, h);
    }

    const state = {
        mouse: { x: 0.72, y: 0.45 },
        target: { x: 0.72, y: 0.45 },
        intro: reduceMotion ? 1 : 0,
        scroll: 0,
    };

    window.addEventListener('pointermove', (e) => {
        state.target.x = e.clientX / window.innerWidth;
        state.target.y = 1 - e.clientY / window.innerHeight;
    }, { passive: true });

    window.addEventListener('resize', () => {
        resize();
        if (reduceMotion) requestAnimationFrame(frame);
    });
    resize();

    const start = performance.now();
    let visible = true;

    function frame(now) {
        const time = reduceMotion ? 12 : (now - start) / 1000;

        state.mouse.x += (state.target.x - state.mouse.x) * 0.04;
        state.mouse.y += (state.target.y - state.mouse.y) * 0.04;
        state.scroll = Math.min(window.scrollY / window.innerHeight, 1);

        gl.uniform1f(u.time, time);
        gl.uniform2f(u.mouse, state.mouse.x, state.mouse.y);
        gl.uniform1f(u.scroll, state.scroll);
        gl.uniform1f(u.intro, state.intro);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (!reduceMotion && visible) requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => {
        const wasVisible = visible;
        visible = document.visibilityState === 'visible';
        if (visible && !wasVisible && !reduceMotion) requestAnimationFrame(frame);
    });

    // Recover gracefully if the GPU drops the context
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        canvas.remove();
    });

    requestAnimationFrame(frame);

    window.VNGL = {
        setIntro(v) {
            state.intro = v;
            if (reduceMotion) requestAnimationFrame(frame);
        },
        get intro() {
            return state.intro;
        },
    };
})();
