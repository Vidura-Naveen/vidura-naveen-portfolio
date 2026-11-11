/* =========================================================
   Vidura Naveen — Portfolio interactions
   GSAP + ScrollTrigger + SplitText + Lenis (all via CDN).
   Everything degrades gracefully: without these libraries,
   or with reduced motion, the page is fully readable.
   ========================================================= */
(() => {
    'use strict';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    let lenis = null;
    const markReady = () => root.classList.add('is-ready');

    /* =====================================================
       1. Library-free features
       ===================================================== */

    // Opened straight from disk (file://)? Folder links like "links/" need an explicit index.html
    if (location.protocol === 'file:') {
        $$('a[href$="/"]').forEach((a) => {
            const href = a.getAttribute('href');
            if (!/^[a-z]+:/i.test(href)) a.setAttribute('href', `${href}index.html`);
        });
    }

    // Footer year
    $$('.year').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

    // Live Colombo clock
    const clockFormat = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const clocks = $$('.clock');
    const tickClock = () => {
        const now = clockFormat.format(new Date());
        clocks.forEach((el) => { el.textContent = now; });
    };
    tickClock();
    setInterval(tickClock, 10000);

    // Letter-roll links: wrap each character so CSS can roll it on hover
    $$('.roll').forEach((link) => {
        const text = link.textContent.trim();
        if (!link.hasAttribute('aria-label')) link.setAttribute('aria-label', text);
        const inner = document.createElement('span');
        inner.className = 'roll__inner';
        inner.setAttribute('aria-hidden', 'true');
        [...text].forEach((char, i) => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.style.setProperty('--i', i);
            span.textContent = char;
            inner.appendChild(span);
        });
        link.textContent = '';
        link.appendChild(inner);
    });

    // Copy email to clipboard
    $$('.copy').forEach((btn) => {
        const label = $('.copy__text', btn);
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy);
            } catch (err) {
                window.location.href = `mailto:${btn.dataset.copy}`;
                return;
            }
            label.textContent = 'Copied!';
            btn.classList.add('is-copied');
            setTimeout(() => {
                label.textContent = 'Copy';
                btn.classList.remove('is-copied');
            }, 2000);
        });
    });

    // Mobile menu
    const menuBtn = $('.nav__menu');
    const menu = $('#menu');
    const menuText = $('.nav__menu-text');
    const isMenuOpen = () => menu.classList.contains('is-open');

    function setMenu(open) {
        root.classList.toggle('menu-open', open);
        menu.classList.toggle('is-open', open);
        menu.toggleAttribute('inert', !open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuText.textContent = open ? menuText.dataset.close : menuText.dataset.open;
        if (lenis) {
            if (open) lenis.stop(); else lenis.start();
        } else {
            document.body.style.overflow = open ? 'hidden' : '';
        }
    }

    menuBtn.addEventListener('click', () => setMenu(!isMenuOpen()));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMenuOpen()) {
            setMenu(false);
            menuBtn.focus();
        }
    });

    // In-page anchors (smooth via Lenis when available)
    function scrollToTarget(target, immediate = false) {
        if (lenis) {
            lenis.scrollTo(target, { duration: 1.6, immediate });
        } else if (target === 0) {
            window.scrollTo({ top: 0 });
        } else {
            target.scrollIntoView();
        }
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        const hash = link.getAttribute('href');
        const target = hash === '#' || hash === '#top' ? 0 : document.querySelector(hash);
        if (target === null) return;
        e.preventDefault();
        if (isMenuOpen()) setMenu(false);
        scrollToTarget(target);
        if (target !== 0) {
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        }
    });

    // Pause SVG (SMIL) animations for reduced-motion users
    if (reduceMotion) $$('svg').forEach((svg) => svg.pauseAnimations && svg.pauseAnimations());

    /* =====================================================
       2. Bail out gracefully if GSAP didn't load
       ===================================================== */
    if (!window.gsap || !window.ScrollTrigger) {
        markReady();
        if (window.VNGL) window.VNGL.setIntro(1);
        if (window.VNORB) window.VNORB.setIntro(1);
        return;
    }

    const { gsap, ScrollTrigger } = window;
    const hasSplit = typeof window.SplitText !== 'undefined';
    gsap.registerPlugin(ScrollTrigger);
    if (hasSplit) gsap.registerPlugin(window.SplitText);

    // Smooth scrolling
    if (!reduceMotion && window.Lenis) {
        lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        lenis.stop();
    }
    window.scrollTo(0, 0);

    /* =====================================================
       3. Preloader → hero intro
       ===================================================== */
    const preloader = $('.preloader');
    const countEl = $('#loader-count');
    const loaderBar = $('.preloader__bar span');
    const counter = { value: 0 };
    const renderCount = () => {
        countEl.textContent = String(Math.round(counter.value));
        loaderBar.style.transform = `scaleX(${counter.value / 100})`;
    };

    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const pageLoaded = new Promise((resolve) => {
        if (document.readyState === 'complete') resolve();
        else window.addEventListener('load', resolve, { once: true });
    });
    const assetsReady = Promise.race([
        Promise.all([fontsReady, pageLoaded]),
        new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);

    const countUp = gsap.to(counter, {
        value: 90,
        duration: reduceMotion ? 0.2 : 1.5,
        ease: 'power2.inOut',
        onUpdate: renderCount,
    });

    Promise.all([assetsReady, countUp.then()]).then(() => {
        gsap.to(counter, {
            value: 100,
            duration: 0.3,
            ease: 'power1.out',
            onUpdate: renderCount,
            onComplete: start,
        });
    });

    function start() {
        // Everything below sets initial (hidden) states while the preloader still covers the page.
        const heroIntro = buildHero();
        buildScrollScenes();

        if (reduceMotion) {
            heroIntro.progress(1);
            markReady();
            if (window.VNGL) window.VNGL.setIntro(1);
            if (window.VNORB) window.VNORB.setIntro(1);
            ScrollTrigger.refresh();
            jumpToHash();
            return;
        }

        gsap.timeline()
            .to(preloader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' })
            .call(() => {
                markReady();
                if (lenis) lenis.start();
                ScrollTrigger.refresh();
                jumpToHash();
            })
            .add(heroIntro.play(), '-=0.55');
    }

    function jumpToHash() {
        if (!location.hash) return;
        const target = document.querySelector(location.hash);
        if (target) scrollToTarget(target, true);
    }

    /* =====================================================
       4. Hero
       ===================================================== */
    function buildHero() {
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });

        // Whole words rise out of their masked lines: calm, no per-letter jitter
        tl.from('.hero__word', {
            yPercent: 105,
            duration: 1.4,
            stagger: 0.12,
        })
            .from('.hero__dot', {
                autoAlpha: 0,
                scale: 0.4,
                duration: 0.8,
                ease: 'back.out(2)',
            }, 0.9)
            .from('[data-hero-fade]', {
                autoAlpha: 0,
                y: 16,
                duration: 1.1,
                stagger: 0.08,
            }, 0.45);

        if (window.VNGL) {
            const glIntro = { v: 0 };
            tl.to(glIntro, {
                v: 1,
                duration: 2.4,
                ease: 'power2.out',
                onUpdate: () => window.VNGL.setIntro(glIntro.v),
            }, 0);
        }

        // 3D atom grows in with an elastic overshoot
        if (window.VNORB) {
            const orbIntro = { v: 0 };
            tl.to(orbIntro, {
                v: 1,
                duration: 2.6,
                ease: 'elastic.out(1, 0.55)',
                onUpdate: () => window.VNORB.setIntro(orbIntro.v),
            }, 0.5);
        }

        // Headline eases up and fades as you scroll away
        if (!reduceMotion) {
            gsap.to('.hero__title', {
                y: () => -window.innerHeight * 0.12,
                autoAlpha: 0.15,
                ease: 'none',
                scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
            });
        }

        return tl;
    }

    /* =====================================================
       5. Scroll scenes
       ===================================================== */
    function buildScrollScenes() {
        const mm = gsap.matchMedia();

        // --- Horizontal work section (created first: it pins, so later triggers must account for it)
        mm.add('(min-width: 961px) and (prefers-reduced-motion: no-preference)', () => {
            const section = $('.work');
            const track = $('.work__track');
            section.classList.add('is-horizontal');

            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

            const slide = gsap.to(track, {
                x: () => -distance(),
                ease: 'none',
                scrollTrigger: {
                    trigger: section,
                    start: 'top top',
                    end: () => `+=${distance()}`,
                    pin: true,
                    scrub: 1,
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                },
            });

            // Big outlined numbers drift inside each card
            $$('.project__index', track).forEach((num) => {
                gsap.fromTo(num, { xPercent: 40 }, {
                    xPercent: -40,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: num.closest('.project'),
                        containerAnimation: slide,
                        start: 'left right',
                        end: 'right left',
                        scrub: true,
                    },
                });
            });

            return () => section.classList.remove('is-horizontal');
        });

        // --- Nav state + progress bar
        const nav = $('#nav');
        const progress = $('.scroll-progress span');
        ScrollTrigger.create({
            start: 0,
            end: 'max',
            onUpdate(self) {
                const y = self.scroll();
                nav.classList.toggle('is-scrolled', y > 40);
                nav.classList.toggle('is-hidden', self.direction === 1 && y > window.innerHeight * 0.6 && !isMenuOpen());
                progress.style.transform = `scaleX(${self.progress})`;
            },
        });

        // Nav switches to dark text over the light section
        ScrollTrigger.create({
            trigger: '.palette-light',
            start: 'top 48px',
            end: 'bottom 48px',
            toggleClass: { targets: root, className: 'on-light' },
        });

        // --- Marquee: endless loop that speeds up and flips with scroll velocity
        const marqueeTrack = $('.marquee__track');
        const marqueeGroup = $('.marquee__group');
        if (marqueeTrack && marqueeGroup) {
            const clone = marqueeGroup.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            marqueeTrack.appendChild(clone);

            const loop = gsap.to(marqueeTrack, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
            loop.totalTime(loop.duration() * 100); // room to play backwards

            if (reduceMotion) {
                loop.pause();
            } else {
                let boost = 0;
                let direction = 1;
                ScrollTrigger.create({
                    start: 0,
                    end: 'max',
                    onUpdate(self) {
                        direction = self.direction;
                        boost = Math.max(boost, Math.min(Math.abs(self.getVelocity()) / 250, 9));
                    },
                });
                gsap.ticker.add(() => {
                    boost *= 0.92;
                    loop.timeScale(direction * (1 + boost));
                });
            }
        }

        if (reduceMotion) return;

        // --- Headings: masked line reveals
        $$('[data-lines]').forEach((el) => {
            if (!hasSplit) return;
            window.SplitText.create(el, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'split-line',
                autoSplit: true,
                onSplit: (self) => gsap.from(self.lines, {
                    yPercent: 110,
                    duration: 1.2,
                    ease: 'expo.out',
                    stagger: 0.08,
                    scrollTrigger: { trigger: el, start: 'top 85%', once: true },
                }),
            });
        });

        // --- About statement: words light up as you scroll
        $$('[data-words]').forEach((el) => {
            if (!hasSplit) return;
            window.SplitText.create(el, {
                type: 'words',
                autoSplit: true,
                onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.12 }, {
                    opacity: 1,
                    ease: 'none',
                    stagger: 0.05,
                    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
                }),
            });
        });

        // --- Generic fade-up reveals, batched
        gsap.set('[data-reveal]', { autoAlpha: 0, y: 48 });
        ScrollTrigger.batch('[data-reveal]', {
            start: 'top 90%',
            once: true,
            onEnter: (batch) => gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 1.1,
                ease: 'expo.out',
                stagger: 0.09,
                overwrite: true,
            }),
        });

        // --- Counters
        $$('[data-count]').forEach((el) => {
            gsap.from(el, {
                textContent: 0,
                duration: 2,
                ease: 'power2.out',
                snap: { textContent: 1 },
                scrollTrigger: { trigger: el, start: 'top 92%', once: true },
            });
        });

        // --- Portrait: clip reveal + parallax
        $$('[data-clip]').forEach((figure) => {
            const img = $('img', figure);
            gsap.fromTo(figure, { clipPath: 'inset(100% 0% 0% 0%)' }, {
                clipPath: 'inset(0% 0% 0% 0%)',
                duration: 1.5,
                ease: 'expo.inOut',
                scrollTrigger: { trigger: figure, start: 'top 85%', once: true },
            });
            if (img) {
                gsap.from(img, {
                    scale: 1.3,
                    duration: 1.8,
                    ease: 'expo.out',
                    scrollTrigger: { trigger: figure, start: 'top 85%', once: true },
                });
                gsap.fromTo(img, { yPercent: -8 }, {
                    yPercent: 8,
                    ease: 'none',
                    scrollTrigger: { trigger: figure, start: 'top bottom', end: 'bottom top', scrub: true },
                });
            }
        });

        // --- Experience timeline draws itself
        const lineFill = $('.exp__line span');
        if (lineFill) {
            gsap.fromTo(lineFill, { scaleY: 0 }, {
                scaleY: 1,
                ease: 'none',
                scrollTrigger: { trigger: '.exp__timeline', start: 'top 65%', end: 'bottom 65%', scrub: true },
            });
            $$('.job').forEach((job) => {
                const marker = $('.job__marker', job);
                ScrollTrigger.create({
                    trigger: job,
                    start: 'top 65%',
                    onEnter: () => marker.classList.add('is-active'),
                    onLeaveBack: () => marker.classList.remove('is-active'),
                });
            });
        }

        // --- Contact title gentle scale-in
        gsap.from('.contact__mail-circle', {
            scale: 0,
            rotate: -90,
            duration: 1.4,
            ease: 'expo.out',
            scrollTrigger: { trigger: '.contact__cta', start: 'top 85%', once: true },
        });
    }

    /* =====================================================
       6. Pointer effects (desktop only)
       ===================================================== */
    if (finePointer) {
        // Custom cursor
        const cursor = $('.cursor');
        const dot = $('.cursor__dot');
        const ring = $('.cursor__ring');
        const label = $('.cursor__label');

        root.classList.add('has-cursor');
        cursor.classList.add('is-hidden');
        gsap.set([dot, ring], { x: window.innerWidth / 2, y: window.innerHeight / 2 });

        const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
        const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
        const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
        const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

        window.addEventListener('pointermove', (e) => {
            dotX(e.clientX);
            dotY(e.clientY);
            ringX(e.clientX);
            ringY(e.clientY);
            cursor.classList.remove('is-hidden');
            const onLight = !!e.target.closest && !!e.target.closest('.palette-light') && !e.target.closest('.card--accent');
            cursor.classList.toggle('is-light', onLight);
        }, { passive: true });

        document.addEventListener('mouseout', (e) => {
            if (!e.relatedTarget) cursor.classList.add('is-hidden');
        });

        document.addEventListener('pointerover', (e) => {
            const target = e.target.closest('[data-cursor], a, button');
            if (!target) {
                cursor.classList.remove('is-hover', 'is-label');
                return;
            }
            if (target.dataset.cursor) {
                label.textContent = target.dataset.cursor;
                cursor.classList.add('is-label');
                cursor.classList.remove('is-hover');
            } else {
                cursor.classList.add('is-hover');
                cursor.classList.remove('is-label');
            }
        });

        // Magnetic buttons
        if (!reduceMotion) {
            $$('.magnetic').forEach((el) => {
                const strength = el.classList.contains('contact__mail') ? 0.4 : 0.3;
                const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
                const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
                el.addEventListener('pointermove', (e) => {
                    const r = el.getBoundingClientRect();
                    xTo((e.clientX - (r.left + r.width / 2)) * strength);
                    yTo((e.clientY - (r.top + r.height / 2)) * strength);
                });
                el.addEventListener('pointerleave', () => {
                    xTo(0);
                    yTo(0);
                });
            });

            // Subtle 3D tilt on project cards
            $$('.project:not(.project--more)').forEach((card) => {
                gsap.set(card, { transformPerspective: 1000 });
                const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
                const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
                card.addEventListener('pointermove', (e) => {
                    const r = card.getBoundingClientRect();
                    const px = (e.clientX - r.left) / r.width - 0.5;
                    const py = (e.clientY - r.top) / r.height - 0.5;
                    rx(py * -6);
                    ry(px * 6);
                });
                card.addEventListener('pointerleave', () => {
                    rx(0);
                    ry(0);
                });
            });
        }

        // Spotlight glow follows the pointer on bento cards
        $$('.spotlight').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            });
        });
    }
})();
