/* =========================================================
   Hero 3D object — a raymarched atom (Bohr model).
   Raw WebGL, no libraries. A glossy nucleus of protons and
   neutrons, three tilted orbit rings and an electron on each
   ring dragging a glowing comet tail.
   Follows the pointer, spins with scroll, sleeps off-screen.
   Exposes window.VNORB = { setIntro(v) } for the intro timeline.
   ========================================================= */
(() => {
    const canvas = document.getElementById('orb');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
        antialias: false,
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        powerPreference: 'high-performance',
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
        uniform vec2  uMouse;   // -1..1
        uniform float uScroll;
        uniform float uIntro;   // 0..1 (grows the atom in)

        const vec3  CYAN   = vec3(0.13, 0.83, 0.93);
        const vec3  INDIGO = vec3(0.36, 0.27, 0.98);
        const float R      = 1.12;    // orbit radius
        const float RING   = 0.004;   // orbit tube radius
        const float ER     = 0.055;   // electron radius
        const float TILT   = 0.38;    // how open each orbit ellipse looks
        const float BOUND  = 1.4;
        const float FOCAL  = 1.2;

        float gId;

        mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

        // world -> model space (scale for the intro, pointer + time + scroll rotation)
        vec3 toModel(vec3 p) {
            p /= max(uIntro, 0.001);
            p.yz *= rot(-uMouse.y * 0.45 - 0.15);
            p.xz *= rot(uTime * 0.22 + uMouse.x * 0.8 + uScroll * 2.4);
            return p;
        }

        float ball(vec3 p, vec3 c, float id, float d) {
            float b = length(p - c) - 0.115;
            if (b < d) gId = id;
            return min(d, b);
        }

        // 9 nucleons; id 0 = proton (cyan), 1 = neutron (indigo)
        float nucleus(vec3 p) {
            float far = length(p) - 0.32;
            if (far > 0.1) return far;
            p.xy *= rot(uTime * 0.4);
            float d = 1e9;
            d = ball(p, vec3( 0.00,  0.00,  0.00), 0.0, d);
            d = ball(p, vec3( 0.15,  0.06,  0.05), 0.0, d);
            d = ball(p, vec3(-0.14,  0.08,  0.06), 1.0, d);
            d = ball(p, vec3( 0.02, -0.15,  0.07), 0.0, d);
            d = ball(p, vec3( 0.03,  0.16, -0.06), 1.0, d);
            d = ball(p, vec3( 0.12, -0.08, -0.11), 1.0, d);
            d = ball(p, vec3(-0.11, -0.09, -0.10), 1.0, d);
            d = ball(p, vec3(-0.03,  0.03,  0.17), 0.0, d);
            d = ball(p, vec3( 0.00,  0.02, -0.17), 1.0, d);
            return d;
        }

        vec3 ringSpace(vec3 p, float a) {
            p.xy *= rot(a);
            p.yz *= rot(TILT);
            return p;
        }

        float electronAngle(float i) {
            return uTime * (0.9 + i * 0.22) + i * 2.1;
        }

        // x = distance to orbit tube, y = distance to its electron
        vec2 orbit(vec3 p, float i) {
            vec3 q = ringSpace(p, i * 1.0472);
            float dO = length(vec2(length(q.xz) - R, q.y)) - RING;
            float th = electronAngle(i);
            float dE = length(q - vec3(cos(th), 0.0, sin(th)) * R) - ER;
            return vec2(dO, dE);
        }

        // brightness of the comet tail at a point on orbit i
        float tail(vec3 pw, float i) {
            vec3 q = ringSpace(toModel(pw), i * 1.0472);
            float ph = atan(q.z, q.x);
            return exp(-mod(electronAngle(i) - ph, 6.28318) * 1.3);
        }

        float nucleusW(vec3 pw) { return nucleus(toModel(pw)) * max(uIntro, 0.001); }

        vec3 nucleusNormal(vec3 p) {
            const vec2 e = vec2(1.0, -1.0) * 0.001;
            return normalize(e.xyy * nucleusW(p + e.xyy) + e.yyx * nucleusW(p + e.yyx) +
                             e.yxy * nucleusW(p + e.yxy) + e.xxx * nucleusW(p + e.xxx));
        }

        vec3 env(vec3 r) {
            vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.06, 0.05, 0.14), smoothstep(-1.0, 1.0, r.y));
            col += CYAN * smoothstep(0.3, 1.0, r.x) * 0.7;
            col += INDIGO * smoothstep(0.2, 1.0, -r.x) * 0.6;
            col += vec3(1.0) * smoothstep(0.75, 0.97, r.y) * 0.9;
            return col;
        }

        vec3 ringLight(float md, float z, float tl, float px, out float a) {
            float core = 1.0 - smoothstep(0.0, px * 1.4, md);
            float halo = exp(-max(md, 0.0) * 24.0) * 0.32;
            float depth = mix(0.3, 1.0, smoothstep(-1.1, 1.1, z));
            float k = (0.38 + 1.7 * tl) * depth;
            a = clamp((core * 0.85 + halo) * k, 0.0, 1.0);
            return (vec3(0.78, 0.95, 1.0) * core * 0.85 + mix(INDIGO, CYAN, tl) * halo) * k;
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
            vec3 ro = vec3(0.0, 0.0, 3.6);
            vec3 rd = normalize(vec3(uv, -FOCAL));
            float s = max(uIntro, 0.001);

            // fade everything to zero before the canvas edge
            vec2 qe = abs(gl_FragCoord.xy / uRes - 0.5);
            float edge = smoothstep(0.5, 0.32, max(qe.x, qe.y));

            vec3 col = vec3(0.0);
            float alpha = 0.0;

            float b = dot(ro, rd);
            float disc = b * b - (dot(ro, ro) - BOUND * BOUND * s * s);
            if (disc <= 0.0) { gl_FragColor = vec4(0.0); return; }

            float t = max(-b - sqrt(disc), 0.0);
            float tEnd = -b + sqrt(disc);

            float mN = 1e9, tN = t;
            float mE = 1e9, tE = t;
            float m0 = 1e9, m1 = 1e9, m2 = 1e9;
            float t0 = t, t1 = t, t2 = t;
            float hit = 0.0;

            for (int i = 0; i < 110; i++) {
                vec3 pw = ro + rd * t;
                vec3 p = toModel(pw);

                float dN = nucleus(p) * s;
                vec2 o0 = orbit(p, 0.0) * s;
                vec2 o1 = orbit(p, 1.0) * s;
                vec2 o2 = orbit(p, 2.0) * s;
                float dE = min(o0.y, min(o1.y, o2.y));

                if (dN < mN) { mN = dN; tN = t; }
                if (dE < mE) { mE = dE; tE = t; }
                if (o0.x < m0) { m0 = o0.x; t0 = t; }
                if (o1.x < m1) { m1 = o1.x; t1 = t; }
                if (o2.x < m2) { m2 = o2.x; t2 = t; }

                if (dN < 0.0008) { hit = 1.0; break; }
                if (dE < 0.0008) { hit = 2.0; break; }

                float dO = min(o0.x, min(o1.x, o2.x));
                t += min(min(dN, dE), max(dO, 0.0025)) * 0.85;
                if (t > tEnd) break;
            }

            // --- nucleus
            float pxN = tN / (uRes.y * FOCAL);
            float covN = hit == 1.0 ? 1.0 : 1.0 - smoothstep(0.0, pxN * 1.5, mN);
            if (covN > 0.0) {
                vec3 p = ro + rd * (hit == 1.0 ? t : tN);
                nucleus(toModel(p));
                float id = gId;
                vec3 n = nucleusNormal(p);
                vec3 L = normalize(vec3(0.5, 0.7, 0.6));
                vec3 r = reflect(rd, n);
                float diff = max(dot(n, L), 0.0);
                float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
                float spec = pow(max(dot(r, L), 0.0), 40.0);
                vec3 base = id < 0.5 ? CYAN : INDIGO;
                vec3 nc = base * (0.1 + 0.85 * diff) + env(r) * 0.3 + spec * 0.9 + base * fres * 0.7;
                nc = 1.0 - exp(-nc * 1.6);
                col = nc * covN;
                alpha = covN;
            }

            // --- electrons (solid core)
            float pxE = tE / (uRes.y * FOCAL);
            float covE = hit == 2.0 ? 1.0 : 1.0 - smoothstep(0.0, pxE * 1.5, mE);
            col = mix(col, vec3(0.88, 0.98, 1.0), covE);
            alpha = max(alpha, covE);

            // --- orbit rings with comet tails (only the parts in front of what we hit)
            float a0, a1, a2;
            vec3 r0 = ringLight(m0, (ro + rd * t0).z, tail(ro + rd * t0, 0.0), t0 / (uRes.y * FOCAL), a0);
            vec3 r1 = ringLight(m1, (ro + rd * t1).z, tail(ro + rd * t1, 1.0), t1 / (uRes.y * FOCAL), a1);
            vec3 r2 = ringLight(m2, (ro + rd * t2).z, tail(ro + rd * t2, 2.0), t2 / (uRes.y * FOCAL), a2);
            col += (r0 + r1 + r2) * edge;
            alpha += (a0 + a1 + a2) * edge;

            // --- glows
            float eh = exp(-max(mE, 0.0) * 16.0) * 0.85 * edge;
            float nh = exp(-max(mN, 0.0) * 6.0) * 0.14 * edge;
            col += CYAN * eh + mix(CYAN, INDIGO, 0.5) * nh;
            alpha += eh + nh;

            alpha = clamp(alpha * min(uIntro * 1.5, 1.0), 0.0, 1.0);
            col *= min(uIntro * 1.5, 1.0);
            gl_FragColor = vec4(col, alpha);
        }
    `;

    function compile(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn('[orb] shader error:', gl.getShaderInfoLog(shader));
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
        console.warn('[orb] link error:', gl.getProgramInfoLog(program));
        canvas.remove();
        return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    const u = {
        res: gl.getUniformLocation(program, 'uRes'),
        time: gl.getUniformLocation(program, 'uTime'),
        mouse: gl.getUniformLocation(program, 'uMouse'),
        scroll: gl.getUniformLocation(program, 'uScroll'),
        intro: gl.getUniformLocation(program, 'uIntro'),
    };

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
        gl.uniform2f(u.res, w, h);
    }

    const state = {
        mouse: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
        intro: reduceMotion ? 1 : 0,
    };

    window.addEventListener('pointermove', (e) => {
        state.target.x = (e.clientX / window.innerWidth) * 2 - 1;
        state.target.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    const start = performance.now();
    let onScreen = true;
    let pageVisible = true;
    let running = false;

    function draw(now) {
        const time = reduceMotion ? 8 : (now - start) / 1000;
        state.mouse.x += (state.target.x - state.mouse.x) * 0.05;
        state.mouse.y += (state.target.y - state.mouse.y) * 0.05;

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(u.time, time);
        gl.uniform2f(u.mouse, state.mouse.x, state.mouse.y);
        gl.uniform1f(u.scroll, Math.min(window.scrollY / window.innerHeight, 2));
        gl.uniform1f(u.intro, state.intro);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
        if (!onScreen || !pageVisible) {
            running = false;
            return;
        }
        draw(now);
        requestAnimationFrame(loop);
    }

    function wake() {
        if (reduceMotion) {
            requestAnimationFrame(draw);
            return;
        }
        if (!running && onScreen && pageVisible) {
            running = true;
            requestAnimationFrame(loop);
        }
    }

    // Only render while the hero is actually visible
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            wake();
        }).observe(canvas);
    }

    if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
            resize();
            if (reduceMotion) requestAnimationFrame(draw);
        }).observe(canvas);
    } else {
        window.addEventListener('resize', resize);
    }

    document.addEventListener('visibilitychange', () => {
        pageVisible = document.visibilityState === 'visible';
        wake();
    });

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        canvas.remove();
    });

    resize();
    wake();

    window.VNORB = {
        setIntro(v) {
            state.intro = v;
            if (reduceMotion) requestAnimationFrame(draw);
        },
    };
})();
